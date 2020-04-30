import { Injectable, OnInit } from "@hacker-und-koch/di";
import { Logger } from "@hacker-und-koch/logger";
import { Events } from "../socket-handlers/events";

export interface ClientIpPayload {
    ip: string;
    port: number;
}

export interface ServerIpPayload {
    uid: string;
    ip: string;
    port: number;
}

@Injectable()
export class Soundjack {

    constructor(private logger: Logger) { }

    // former initializeSingleSocket
    public async connectSocketToStage(socket: SocketIO.Socket, stage: string, uid: string) {
        socket.on(Events.stage.soundjack.sendIp, (data: ClientIpPayload) => {
            this.logger.spam(`received ${Events.stage.soundjack.sendIp} on stage ${stage}. will emit ${Events.stage.soundjack.ipSent}.`);
            socket.emit(Events.stage.soundjack.ipSent, {
                uid: uid,
                ip: data.ip,
                port: data.port
            } as ServerIpPayload);
        });
    };
};
