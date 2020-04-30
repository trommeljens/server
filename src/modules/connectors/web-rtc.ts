import { Injectable, OnInit } from "@hacker-und-koch/di";
import { Logger } from "@hacker-und-koch/logger";

import * as firebase from 'firebase-admin';

export declare type WebRtcAction
    = 'p2p/peer-added';

@Injectable()
export class WebRTC implements OnInit {

    constructor(private logger: Logger) { }

    async onInit() {
        this.logger.log("Initialized WebRTC");
    }

    // former initializeSingleSocket
    public async connectSocketToStage(socket: SocketIO.Socket, stage: string, user: firebase.auth.UserRecord) {
        // socket.broadcast.to(stage).emit("stg/p2p/peer-added", {
        //     uid: user.uid,
        //     socketId: socket.id
        // });

        // this.events.next({
        //     action: 'p2p/peer-added',
        //     stageId: stage,
        //     sender: socket,
        //     payload: {
        //         uid: user.uid,
        //         socketId: socket.id
        //     }
        // });

        socket.on("stg/p2p/make-offer", (data: {
            uid: string;
            socketId: string;
            targetSocketId: string;
            offer: RTCSessionDescriptionInit;
        }) => {
            socket.to(data.targetSocketId).emit("stg/p2p/offer-made", {
                uid: user.uid,
                socketId: socket.id,
                offer: data.offer
            });
        });

        socket.on("stg/p2p/make-answer", (data: {
            uid: string;
            socketId: string;
            targetSocketId: string;
            answer: RTCSessionDescriptionInit;
        }) => {
            socket.to(data.targetSocketId).emit("stg/p2p/answer-made", {
                uid: user.uid,
                socketId: socket.id,
                answer: data.answer
            });
        });

        socket.on("stg/p2p/send-candidate", (data) => {
            socket.to(data.targetSocketId).emit("stg/p2p/candidate-sent", {
                uid: user.uid,
                socketId: socket.id,
                candidate: data.candidate
            });
        });
    };
};
