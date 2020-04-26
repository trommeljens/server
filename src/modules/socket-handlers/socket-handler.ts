import { Injectable } from "@hacker-und-koch/di";
import { Logger } from "@hacker-und-koch/logger";
import { StageCreatePayload, StageJoinPayload } from "./stage-manager";
import { StageManager } from './stage-manager';

import { Events } from './events';

@Injectable()
export class SocketHandler {
    constructor(
        private logger: Logger,
        private stageManager: StageManager,
    ) { }

    async handle(socket: SocketIO.Socket) {
        this.logger.log(`Got new socket connection ${socket.id} from ${socket.handshake.address}`);

        socket.on(Events.stage.create, async (data: StageCreatePayload, callback) => {
            const docRefId = await this.stageManager.handleStageCreate(socket, data);
            callback(docRefId);
        });

        socket.on(Events.stage.join, async (data: StageJoinPayload, callback) => {
            const response = await this.stageManager.handleStageJoin(socket, data);
            callback(response);
        });
    }

}
