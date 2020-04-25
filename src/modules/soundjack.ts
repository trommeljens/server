import { Injectable, OnInit } from "@hacker-und-koch/di";
import { Logger } from "@hacker-und-koch/logger";

@Injectable()
export class Soundjack {

    constructor(private logger: Logger) { }

    // former initializeSingleSocket
    public async connectSocketToStage(socket: SocketIO.Socket, stage: string, uid: string) {
        socket.broadcast.to(stage).emit("p2p/peer-added", {
            uid: uid,
            socketId: socket.id
        });
        
        this.logger.info(`did emit p2p/peer-added on stage ${stage}`);

        socket.on("con/sj/send-ip", (data: {
            ip: string;
            port: number;
        }) => {
            this.logger.spam(`received sj/send-ip on stage ${stage}. will emit sj/ip-sent.`);
            socket.emit("con/sj/ip-sent", {
                uid: uid,
                ip: data.ip,
                port: data.port
            });
        });
    };
};
