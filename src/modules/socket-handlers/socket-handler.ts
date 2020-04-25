import { Injectable, OnInit, OnDestroy } from "@hacker-und-koch/di";
import { Logger } from "@hacker-und-koch/logger";
import { Socket } from "socket.io";
import { Stage } from "./stage";

export interface BroadcastEvent {
    action: string;
    issuer: Socket;
}

@Injectable()
export class SocketHandler {
    constructor(

        private logger: Logger,
        private stage: Stage,
    ) {

    }

    async handle(socket: SocketIO.Socket) {
        console.log("Got new socket connection " + socket.id + " from " + socket.handshake.address);


        socket.on("stg/create", async (data: {
            token: string;
            stageName: string;
            type: "theater" | "music" | "conference";
            password: string | null;
        }, callback) => {
            this.stage.handleStageCreate(socket, data, callback)
        });

        socket.on("stg/join", async (data: {
            token: string;
            stageId: string;
            password: string | null;
        }, callback) => {
            this.stage.handleStageJoin(socket, data, callback);
        });
    }

}