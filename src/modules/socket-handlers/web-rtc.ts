import { Injectable, OnInit } from "@hacker-und-koch/di";
import { Logger } from "@hacker-und-koch/logger";

@Injectable()
export class WebRTC implements OnInit {

    constructor(private logger: Logger) { }

    async onInit() {
        this.logger.log("Initialized WebRTC");
    }

    // former initializeSingleSocket
    public async connectSocketToStage(socket: SocketIO.Socket, stage: string, uid: string) {
        socket.broadcast.to(stage).emit("con/p2p/peer-added", {
            uid: uid,
            socketId: socket.id
        });

        socket.on("con/p2p/make-offer", (data: {
            uid: string;
            socketId: string;
            targetSocketId: string;
            offer: RTCSessionDescriptionInit;
        }) => {
            socket.to(data.targetSocketId).emit("con/p2p/offer-made", {
                uid: uid,
                socketId: socket.id,
                offer: data.offer
            });
        });

        socket.on("con/p2p/make-answer", (data: {
            uid: string;
            socketId: string;
            targetSocketId: string;
            answer: RTCSessionDescriptionInit;
        }) => {
            socket.to(data.targetSocketId).emit("con/p2p/answer-made", {
                uid: uid,
                socketId: socket.id,
                answer: data.answer
            });
        });

        socket.on("con/p2p/send-candidate", (data) => {
            socket.to(data.targetSocketId).emit("con/p2p/candidate-sent", {
                uid: uid,
                socketId: socket.id,
                candidate: data.candidate
            });
        });
    };
};
