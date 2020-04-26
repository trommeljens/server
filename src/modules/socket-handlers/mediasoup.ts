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
import { BehaviorSubject, Subject } from "rxjs";
import { Events } from "./events";
import { StageEvent } from "./stage";

export interface MediasoupProducerResponse {
    userId: string;
    producer: string[];
}

export interface MediasoupClient {
    user: firebase.auth.UserRecord;
    producer: Producer[];
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
    } = {};

    public events: Subject<StageEvent<any>> = new Subject();

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
            const mediaCodecs = config.mediasoup.routerOptions.mediaCodecs;
            this.router[stageId] = await this.worker.createRouter({ mediaCodecs });
            this.logger.log(`did create new router for stage ${stageId} with codecs:`, this.router[stageId].rtpCapabilities);
        }

        const router = this.router[stageId];

        this.logger.spam('Router capabilities:', router.rtpCapabilities);

        const client: MediasoupClient = {
            user,
            producer: [], // Send client only producerIds (!)
            transports: {}, // Do not send
            consumers: {}, // Do not send
            router,
        };

        socket.on("stg/ms/get-rtp-capabilities", async ({ }, callback) => {
            this.logger.info(`${socket.id}: stg/ms/get-rtp-capabilities`);
            callback(router.rtpCapabilities);
        });

        /*** CREATE SEND TRANSPORT ***/
        socket.on("stg/ms/create-send-transport", async (data: {}, callback) => {
            this.logger.info(`${socket.id}: stg/ms/create-send-transport`);
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
            this.logger.info(`${socket.id}: stg/ms/create-receive-transport`);
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
            this.logger.info(`${socket.id}: stg/ms/connect-transport ${data.transportId}`);
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
            this.logger.info(`${socket.id}: stg/ms/send-track`);
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
                this.logger.info("producer's transport closed", producer.id);
                
                this.events.next({
                    action: "ms/producer/removed",
                    stageId: stageId,
                    sender: socket,
                    payload: {
                        userId: user.uid,
                        producer: producer.id
                    }
                });

                //closeProducer(producer); ??
            });

            client.producer.push(producer);

            this.events.next({
                action: "ms/producers/state",
                stageId: stageId,
                sender: socket,
                payload: {
                    userId: user.uid,
                    producer: client.producer.map(p => p.id)
                }
            });

            this.events.next({
                action: "ms/producer/added",
                stageId: stageId,
                sender: socket,
                payload: {
                    producer: producer.id,
                    userId: user.uid,
                }
            });

            callback({ id: producer.id });
        });

        /*** CONSUME (paused track) ***/
        socket.on("stg/ms/consume", async (data: {
            producerId: string;
            transportId: string;
            rtpCapabilities: RtpCapabilities;
        }, callback) => {
            this.logger.info(`${socket.id}: consume`);
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
            this.logger.info(`${socket.id}: finished consume`);
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
