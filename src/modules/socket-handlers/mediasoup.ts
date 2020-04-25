import {Injectable, OnInit} from "@hacker-und-koch/di";
import {Logger} from "@hacker-und-koch/logger";
import SocketIO from "socket.io";
import {Router} from "mediasoup/lib/Router";
import {WebRtcTransport} from "mediasoup/lib/WebRtcTransport";
import {Producer} from "mediasoup/lib/Producer";
import {Consumer} from "mediasoup/lib/Consumer";
import {RtpCapabilities} from "mediasoup/lib/RtpParameters";
import {DtlsParameters} from "mediasoup/src/WebRtcTransport";
import {MediaKind, RtpParameters} from "mediasoup/src/RtpParameters";

const mediasoup = require("mediasoup");

const config = require("../../config");

interface Stage {
    id: string;
    router: Router;
    clients: MediasoupClient[];
}

interface MediasoupClient {
    uid: string;    // User id, also valid in the outside world
    transports: Transport[];
    producer: Producer[];
    consumers: Consumer[];
}

@Injectable()
export class Mediasoup implements OnInit {

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

    private stages: Stage[];


    private getStage = async (stageId: string): Promise<Stage> => {
        const stage: Stage = this.stages.find((stage: Stage) => stage.id === stageId);
        if (!stage) {
            // Create stage
            this.stages.push({
                id: stageId,
                router: await this.worker.createRouter(config.mediasoup.routerOptions.mediaCodecs),
                clients: []
            });
        }
        return stage;
    };

    public connectSocketToStage = async (socket: SocketIO.Socket, stageId: string, uid: string) => {
        const stage: Stage = await this.getStage(stageId);
        const client: MediasoupClient = {
            uid: uid,
            producer: [],   // Send client only producerIds (!)
            transports: [], // Do not send
            consumers: [] // Do not send
        };
        stage.clients.push(client);


        socket.on("stg/ms/get-rtp-capabilities", async ({}, callback) => {
            console.log(socket.id + ": stg/ms/get-rtp-capabilities");
            console.log(stage.router.rtpCapabilities);
            callback(stage.router.rtpCapabilities);
        });

        /*** CREATE SEND TRANSPORT ***/
        socket.on("stg/ms/create-send-transport", async (data: {}, callback) => {
            console.log(socket.id + ": stg/ms/create-send-transport");
            try {
                const transport: WebRtcTransport = await stage.router.createWebRtcTransport({
                    listenIps: config.mediasoup.webRtcTransport.listenIps,
                    enableUdp: true,
                    enableTcp: true,
                    preferUdp: true,
                    initialAvailableOutgoingBitrate: config.mediasoup.webRtcTransport.initialAvailableOutgoingBitrate
                });
                if (config.mediasoup.webRtcTransport.maxIncomingBitrate) {
                    await transport.setMaxIncomingBitrate(config.mediasoup.webRtcTransport.maxIncomingBitrate);
                }
                transports[transport.id] = transport;
                callback({
                    id: transport.id,
                    iceParameters: transport.iceParameters,
                    iceCandidates: transport.iceCandidates,
                    dtlsParameters: transport.dtlsParameters
                });
            } catch (error) {
                callback({error: error});
            }
        });

        /*** CREATE RECEIVE TRANSPORT ***/
        socket.on("stg/ms/create-receive-transport", async (data: {
            rtpCapabilities: RtpCapabilities;
        }, callback) => {
            console.log(socket.id + ": stg/ms/create-receive-transport");
            const transport: WebRtcTransport = await stage.router.createWebRtcTransport({
                listenIps: config.mediasoup.webRtcTransport.listenIps,
                enableUdp: true,
                enableTcp: true,
                preferUdp: true,
                initialAvailableOutgoingBitrate: config.mediasoup.webRtcTransport.initialAvailableOutgoingBitrate
            });
            transports[transport.id] = transport;
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
            const transport: WebRtcTransport = transports[data.transportId];
            if (!transport) {
                callback({error: "Could not find transport " + data.transportId});
                return;
            }
            await transport.connect({dtlsParameters: data.dtlsParameters});
            /*** ANSWER BY SENDING EXISTING MEMBERS AND DIRECTOR ***/
            callback({connected: true});
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
                callback({error: "Could not find transport " + data.transportId});
                return;
            }
            const producer: Producer = await transport.produce({
                kind: data.kind,
                rtpParameters: data.rtpParameters
            });
            producer.on("transportclose", () => {
                console.log("producer's transport closed", producer.id);
                //closeProducer(producer);
            });
            client.producers.push(producer);
            // Inform all about new producer
            socket.broadcast.emit("producer-added", {
                uid: uid,
                producerId: producer.id
            });
            callback({id: producer.id});
        });

        /*** CONSUME (paused track) ***/
        socket.on("stg/ms/consume", async (data: {
            producerId: string;
            transportId: string;
            rtpCapabilities: RtpCapabilities;
        }, callback) => {
            console.log(socket.id + ": consume");
            const transport: WebRtcTransport = transports[data.transportId];
            if (!transport) {
                callback({error: "Could not find transport " + data.transportId});
                return;
            }
            const consumer: Consumer = await transport.consume({
                producerId: data.producerId,
                rtpCapabilities: data.rtpCapabilities,
                paused: true
            });
            consumers[consumer.id] = consumer;
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
            const consumer: Consumer = consumers[data.consumerId];
            if (!consumer) {
                return callback({error: "consumer not found"});
            }
            consumer.resume().then(
                () => callback()
            );
        });
    };
}
