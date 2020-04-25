import { Injectable, OnInit, OnDestroy } from "@hacker-und-koch/di";
import { Logger } from "@hacker-und-koch/logger";
import * as firebase from 'firebase-admin';
import { Subject } from 'rxjs';
import { Socket } from "socket.io";

import { Mediasoup } from "./mediasoup";
import { WebRTC } from "./web-rtc";
import { Soundjack } from "./soundjack";
import { Firebase } from "./firebase";

export interface BroadcastEvent {
    action: string;
    issuer: Socket;
}

@Injectable()
export class SocketHandler implements OnDestroy {

    public broadcastEvents: Subject<BroadcastEvent> = new Subject<BroadcastEvent>();

    constructor(
        private mediasoup: Mediasoup,
        private webRtc: WebRTC,
        private soundjack: Soundjack,
        private firebase: Firebase,
        private logger: Logger,
    ) {

    }

    async onInit() {
        this.broadcastEvents.subscribe({
            complete: () => this.logger.info('broadcastEvents completed'),
        });
    }

    async onDestroy() {
        this.broadcastEvents.complete();
    }

    async handle(socket: SocketIO.Socket) {
        console.log("Got new socket connection " + socket.id + " from " + socket.handshake.address);



        socket.on("stg/create", (data: {
            token: string;
            stageName: string;
            type: "theater" | "music" | "conference";
            password: string | null;
        }, callback) => {
            this.handleStageCreate(socket, data, callback)
        });

        socket.on("stg/join", (data: {
            token: string;
            stageId: string;
            password: string | null;
        }, callback) => {
            this.handleStageJoin(socket, data, callback);
        });
    }

    private async joinRoomAndInitializeAllServices(socket: SocketIO.Socket, stageId: string, user: firebase.auth.UserRecord) {
        socket.join(stageId);

        await this.webRtc.connectSocketToStage(socket, stageId, user.uid);
        await this.mediasoup.connectSocketToStage(socket, stageId, user.uid);
        await this.soundjack.connectSocketToStage(socket, stageId, user.uid);

        socket.broadcast.to(stageId).emit("stg/client-added", {
            uid: user.uid,
            name: user.displayName,
            socketId: socket.id
        });
    };

    private handleStageCreate(socket: SocketIO.Socket, data: {
        token: string;
        stageName: string;
        type: "theater" | "music" | "conference";
        password: string | null;
    }, callback: (...args: any[]) => void) {
        console.log("create-stage()");
        this.firebase.admin.auth().verifyIdToken(data.token)
            .then((decodedIdToken: firebase.auth.DecodedIdToken) => {
                //TODO: Add role management by verifying permission to create stage
                this.firebase.admin.firestore().collection("stages").add({
                    name: data.stageName,
                    type: data.type,
                    password: data.password,
                    directorUid: decodedIdToken.uid
                }).then((docRef: firebase.firestore.DocumentReference) => {
                    this.firebase.admin.auth().getUser(decodedIdToken.uid)
                        .then((user: firebase.auth.UserRecord) => {
                            this.joinRoomAndInitializeAllServices(socket, docRef.id, user)
                                .then(() => callback(docRef.id));
                        });
                });
            });
    }

    private handleStageJoin(socket: SocketIO.Socket, data: {
        token: string;
        stageId: string;
        password: string | null;
    }, callback: (...args: any[]) => void) {
        console.log("join-stage()");
        this.firebase.admin.auth()
            .verifyIdToken(data.token)
            .then((decodedIdToken: firebase.auth.DecodedIdToken) => {
                //TODO: Add role management by verifying access to stage
                this.firebase.admin.firestore().collection("stages").doc(data.stageId).get()
                    .then((doc: firebase.firestore.DocumentSnapshot) => {
                        if (doc.exists) {
                            const docData = doc.data();
                            if (docData.password === data.password) { // no hashing?
                                this.firebase.admin.auth().getUser(decodedIdToken.uid)
                                    .then((user: firebase.auth.UserRecord) => {
                                        this.joinRoomAndInitializeAllServices(socket, data.stageId, user);
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
    }
}