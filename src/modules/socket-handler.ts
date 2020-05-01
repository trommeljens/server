import { Injectable } from "@hacker-und-koch/di";
import { Logger } from "@hacker-und-koch/logger";
import { StageCreatePayload, StageJoinPayload } from "./stage";
import { StageManager } from './stage';

import { Events } from './socket-handlers/events';
import { SessionManager } from "./session-manager";
import { throws } from "assert";

@Injectable()
export class SocketHandler {

    private sockets: { [socketId: string]: SocketIO.Socket } = {};


    constructor(
        private logger: Logger,
        private sessionManager: SessionManager,
        // private stageManager: StageManager,
    ) { }

    async handle(socket: SocketIO.Socket) {
        this.logger.log(`Got new socket connection ${socket.id} from ${socket.handshake.address}`);
        socket.request;
        this.sockets[socket.id] = socket;
        socket.on('disconnect', () => {
            this.sessionManager.announceDisconnect(socket.id);
            delete this.sockets[socket.id];
        });

        socket.on('init-session', async (data, callback) => {
            try {
                const session = await this.sessionManager.getSession(data.token, socket.id);
                callback({
                    session: session.id,
                });
            } catch (error) {
                callback({ error });
            }
        });

        /* Mediasoup */



        // socket.on(Events.stage.create, async (data: StageCreatePayload, callback) => {
        //     // const docRefId = await this.stageManager.handleStageCreate(socket, data);
        //     callback(docRefId);
        // });

        // socket.on(Events.stage.join, async (data: StageJoinPayload, callback) => {
        //     const response = await this.stageManager.handleStageJoin(socket, data);
        //     callback(response);
        // });
    }

}
