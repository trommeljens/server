import { Injectable, OnInit } from "@hacker-und-koch/di";
import { Logger } from "@hacker-und-koch/logger";
import SocketIO from "socket.io";
import * as firebase from 'firebase-admin';
import { WebRtcTransport } from "mediasoup/lib/WebRtcTransport";
import { Producer } from "mediasoup/lib/Producer";
import { Consumer } from "mediasoup/lib/Consumer";
import { Router } from "mediasoup/lib/Router";
import { Worker } from "mediasoup/lib/Worker";
import { RtpCapabilities } from "mediasoup/lib/RtpParameters";
import { DtlsParameters } from "mediasoup/src/WebRtcTransport";
import { MediaKind, RtpParameters } from "mediasoup/src/RtpParameters";
import { BehaviorSubject } from "rxjs";
import { Events } from "./events";

export interface MediasoupProducerResponse {
    userId: string;
    producer: Producer[];
}

export interface MediasoupClient {
    user: firebase.auth.UserRecord;
    producer: BehaviorSubject<Producer[]>;
    transports: { [key: string]: WebRtcTransport };
    consumers: { [key: string]: Consumer };
    router: Router;
}

const mediasoup = require("mediasoup");

const config = require("../../config");

@Injectable()
export class Mediasoup implements OnInit {

    private worker: Worker;

    private router: {
        [id: string]: Router
    };

    constructor(private logger: Logger) {

    }

    async onInit() { // former initialize()
        this.worker = await mediasoup.createWorker({
            logLevel: config.mediasoup.worker.logLevel,
            logTags: config.mediasoup.worker.logTags,
            rtcMinPort: config.mediasoup.worker.rtcMinPort,
            rtcMaxPort: config.mediasoup.worker.rtcMaxPort
        });
        this.logger.log("Initialized Mediasoup");
    }

    public async connectSocketToStage(socket: SocketIO.Socket, stageId: string, user: firebase.auth.UserRecord) {
        if (typeof this.router[stageId] === 'undefined') {
            this.router[stageId] = await this.worker.createRouter(config.mediasoup.routerOptions.mediaCodecs);
        }

        const router = this.router[stageId];

        this.logger.spam('Router capabilities:', router.rtpCapabilities);

        const client: MediasoupClient = {
            user,
            producer: new BehaviorSubject([]),   // Send client only producerIds (!)
            transports: {}, // Do not send
            consumers: {}, // Do not send
            router,
        };

        client.producer
            .subscribe(producer => socket.broadcast.to(stageId)
                .emit(
                    Events.stage.mediasoup.producer.update,
                    {
                        producer,
                        userId: user.uid,
                    } as MediasoupProducerResponse
                ));

        socket.on("stg/ms/get-rtp-capabilities", async ({ }, callback) => {
            console.log(socket.id + ": stg/ms/get-rtp-capabilities");
            console.log(router.rtpCapabilities);
            callback(router.rtpCapabilities);
        });

        /*** CREATE SEND TRANSPORT ***/
        socket.on("stg/ms/create-send-transport", async (data: {}, callback) => {
            console.log(socket.id + ": stg/ms/create-send-transport");
            try {
                const transport: WebRtcTransport = await router.createWebRtcTransport({
                    listenIps: config.mediasoup.webRtcTransport.listenIps,
                    enableUdp: true,
                    enableTcp: true,
                    preferUdp: true,
                    initialAvailableOutgoingBitrate: config.mediasoup.webRtcTransport.initialAvailableOutgoingBitrate
                });
                if (config.mediasoup.webRtcTransport.maxIncomingBitrate) {
                    await transport.setMaxIncomingBitrate(config.mediasoup.webRtcTransport.maxIncomingBitrate);
                }
                client.transports[transport.id] = transport;
                callback({
                    id: transport.id,
                    iceParameters: transport.iceParameters,
                    iceCandidates: transport.iceCandidates,
                    dtlsParameters: transport.dtlsParameters
                });
            } catch (error) {
                callback({ error: error });
            }
        });

        /*** CREATE RECEIVE TRANSPORT ***/
        socket.on("stg/ms/create-receive-transport", async (data: {
            rtpCapabilities: RtpCapabilities;
        }, callback) => {
            console.log(socket.id + ": stg/ms/create-receive-transport");
            const transport: WebRtcTransport = await router.createWebRtcTransport({
                listenIps: config.mediasoup.webRtcTransport.listenIps,
                enableUdp: true,
                enableTcp: true,
                preferUdp: true,
                initialAvailableOutgoingBitrate: config.mediasoup.webRtcTransport.initialAvailableOutgoingBitrate
            });
            client.transports[transport.id] = transport;
            callback({
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters
            });
        });

        /*** CONNECT TRANSPORT ***/
        socket.on("stg/ms/connect-transport", async (data: {
            transportId: string;
            dtlsParameters: DtlsParameters;
        }, callback) => {
            console.log(socket.id + ": stg/ms/connect-transport " + data.transportId);
            const transport: WebRtcTransport = client.transports[data.transportId];
            if (!transport) {
                callback({ error: "Could not find transport " + data.transportId });
                return;
            }
            await transport.connect({ dtlsParameters: data.dtlsParameters });
            /*** ANSWER BY SENDING EXISTING MEMBERS AND DIRECTOR ***/
            callback({ connected: true });
        });

        /*** SEND TRACK ***/
        socket.on("stg/ms/send-track", async (data: {
            transportId: string;
            rtpParameters: RtpParameters;
            kind: MediaKind;
        }, callback) => {
            console.log(socket.id + ": stg/ms/send-track");
            const transport: WebRtcTransport = client.transports[data.transportId];
            if (!transport) {
                callback({ error: "Could not find transport " + data.transportId });
                return;
            }
            const producer: Producer = await transport.produce({
                kind: data.kind,
                rtpParameters: data.rtpParameters
            });
            producer.on("transportclose", () => {
                console.log("producer's transport closed", producer.id);
                //closeProducer(producer); ??
            });

            client.producer.next([
                ...client.producer.value,
                producer
            ]);

            // Inform all about new producer
            socket.broadcast.emit("producer-added", {
                uid: client.user.uid,
                producerId: producer.id
            });

            callback({ id: producer.id });
        });

        /*** CONSUME (paused track) ***/
        socket.on("stg/ms/consume", async (data: {
            producerId: string;
            transportId: string;
            rtpCapabilities: RtpCapabilities;
        }, callback) => {
            console.log(socket.id + ": consume");
            const transport: WebRtcTransport = client.transports[data.transportId];
            if (!transport) {
                callback({ error: "Could not find transport " + data.transportId });
                return;
            }
            const consumer: Consumer = await transport.consume({
                producerId: data.producerId,
                rtpCapabilities: data.rtpCapabilities,
                paused: true
            });
            client.consumers[consumer.id] = consumer;
            callback({
                id: consumer.id,
                producerId: consumer.producerId,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
                producerPaused: consumer.producerPaused,
                type: consumer.type
            });
        });

        /*** FINISH CONSUME (resume track after successful consume establishment) ***/
        socket.on("stg/ms/finish-consume", async (data: {
            uid: string;
            consumerId: string;
        }, callback) => {
            console.log(socket.id + ": finished consume");
            const consumer: Consumer = client.consumers[data.consumerId];
            if (!consumer) {
                return callback({ error: "consumer not found" });
            }
            consumer.resume().then(
                () => callback()
            );
        });

        return client;
    };
}
