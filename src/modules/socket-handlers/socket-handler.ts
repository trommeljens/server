import { Injectable } from "@hacker-und-koch/di";
import { Logger } from "@hacker-und-koch/logger";
import { Stage, StageCreatePayload, StageJoinPayload } from "./stage";
import { Events } from './events';

@Injectable()
export class SocketHandler {
    constructor(
        private logger: Logger,
        private stage: Stage,
    ) { }

    async handle(socket: SocketIO.Socket) {
        this.logger.log(`Got new socket connection ${socket.id} from ${socket.handshake.address}`);

        socket.on(Events.stage.create, async (data: StageCreatePayload, callback) => {
            const docRefId = await this.stage.handleStageCreate(socket, data);
            callback(docRefId);
        });

        socket.on(Events.stage.join, async (data: StageJoinPayload, callback) => {
            const response = await this.stage.handleStageJoin(socket, data);
            callback(response);
        });
    }

}
