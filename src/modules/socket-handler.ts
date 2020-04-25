import { Injectable, OnInit } from "@hacker-und-koch/di";
import { MediasoupHandler } from "./mediasoup";
import { WebRTCHandler } from "./web-rtc";
import { Firebase } from "./firebase";
import * as firebase from 'firebase-admin';

@Injectable()
export class SocketHandler {

    constructor(
        private mediasoup: MediasoupHandler,
        private webRtc: WebRTCHandler,
        private firebase: Firebase,
    ) { }

    handle(socket: SocketIO.Socket) {
        console.log("Got new socket connection " + socket.id + " from " + socket.handshake.address);

        const joinRoomAndInitializeAllServices = (stageId: string, user: firebase.auth.UserRecord) => {
            socket.join(stageId);
            // Add socket event handler for webrtc (p2p-*), mediasoup (ms-*) and soundjack (sj-*)
            this.webRtc.initializeSingleSocket(socket, stageId, user.uid);
            this.mediasoup.initializeSingleSocket(socket, stageId, user.uid);
            socket.on("sj-send-ip", (data: {
                ip: string;
                port: number;
            }) => {
                socket.emit("sj-ip-sent", {
                    uid: user.uid,
                    ip: data.ip,
                    port: data.port
                });
            });
            socket.broadcast.to(stageId).emit("client-added", {
                uid: user.uid,
                name: user.displayName,
                socketId: socket.id
            });
        };

        socket.on("create-stage", (data: {
            token: string;
            stageName: string;
            type: "theater" | "music" | "conference";
            password: string | null;
        }, callback) => {
            console.log("create-stage()");
            this.firebase.admin.auth().verifyIdToken(data.token)
                .then(
                    (decodedIdToken: firebase.auth.DecodedIdToken) => {
                        //TODO: Add role management by verifying permission to create stage
                        this.firebase.admin.firestore().collection("stages").add({
                            name: data.stageName,
                            type: data.type,
                            password: data.password,
                            directorUid: decodedIdToken.uid
                        }).then(
                            (docRef: firebase.firestore.DocumentReference) => {
                                this.firebase.admin.auth().getUser(decodedIdToken.uid).then(
                                    (user: firebase.auth.UserRecord) => {
                                        joinRoomAndInitializeAllServices(docRef.id, user);
                                        callback(docRef.id);
                                    }
                                )
                            }
                        );
                    });
        });

        socket.on("join-stage", (data: {
            token: string;
            stageId: string;
            password: string | null;
        }, callback) => {
            console.log("join-stage()");
            this.firebase.admin.auth().verifyIdToken(data.token)
                .then(
                    (decodedIdToken: firebase.auth.DecodedIdToken) => {
                        //TODO: Add role management by verifying access to stage
                        this.firebase.admin.firestore().collection("stages").doc(data.stageId).get()
                            .then((doc: firebase.firestore.DocumentSnapshot) => {
                                if (doc.exists) {
                                    const docData = doc.data();
                                    if (docData.password === data.password) {
                                        this.firebase.admin.auth().getUser(decodedIdToken.uid).then(
                                            (user: firebase.auth.UserRecord) => {
                                                joinRoomAndInitializeAllServices(data.stageId, user);
                                                callback({
                                                    stage: {
                                                        ...docData,
                                                        id: data.stageId
                                                    }
                                                });
                                            });
                                    } else {
                                        callback({ error: "Wrong password" });
                                    }
                                } else {
                                    callback({ error: "Could not find stage" });
                                }
                            });
                    });
        });

        // DEPRECATED
        socket.broadcast.emit('add-users', {
            users: [socket.id]
        });

        socket.on('connect', () => {
            // socketServer.emit('add-users', socket.id);
        });

        socket.on('disconnect', () => {
            // socketServer.emit('remove-user', socket.id);
        });

        socket.on('make-offer', (data) => {
            socket.to(data.to).emit('offer-made', {
                offer: data.offer,
                socket: socket.id
            });
        });

        socket.on('make-answer', (data) => {
            socket.to(data.to).emit('answer-made', {
                socket: socket.id,
                answer: data.answer
            });
        });

        socket.on('send-candidate', (data) => {
            socket.to(data.to).emit('candidate-sent', {
                socket: socket.id,
                candidate: data.candidate
            });
        });
    }
}