import { Injectable, OnInit } from "@hacker-und-koch/di";
import { Logger } from "@hacker-und-koch/logger";
import * as firebase from 'firebase-admin';

import { WebRTC, Soundjack, Mediasoup, MediasoupProducerResponse } from "../connectors";
import { Firebase } from "../firebase";
import { Stage, StageParticipantAnnouncement } from "./stage";
import { Events } from "../socket-handlers/events";

export interface StageCreatePayload {
    token: string;
    stageName: string;
    type: "theater" | "music" | "conference";
    password: string;
}

export interface StageJoinPayload {
    token: string;
    stageId: string;
    password: string;
}

@Injectable()
export class StageManager {

    private stages: { [key: string]: Stage } = {};

    constructor(
        private mediasoup: Mediasoup,
        private webRtc: WebRTC,
        private soundjack: Soundjack,
        private firebase: Firebase,
        private logger: Logger,
    ) { }

    onConfigure() {

    }

    public async joinStageAndInitializeAllServices(
        socket: SocketIO.Socket,
        stageId: string,
        user: firebase.auth.UserRecord
    ): Promise<Stage> {
        socket.join(stageId);

        let stage = this.stages[stageId];
        if (typeof stage === 'undefined') {
            //  maybe better: throw new Error(`trying to add socket to non-existend stage ${stageId}`);
            stage = this.createStage(stageId);
        }

        const [_, mediasoupClient] = await Promise.all([
            this.webRtc.connectSocketToStage(socket, stageId, user),
            this.mediasoup.connectSocketToStage(socket, stageId, user),
            this.soundjack.connectSocketToStage(socket, stageId, user.uid),
        ]);

        const participant = {
            user,
            socket,
            stageId,
            mediasoupClient,
        };

        this.logger.info(`adding participant ${user.uid} to stage ${stageId}`);
        stage.addParticipant(participant);

        this.logger.info(`stage ${stageId} has now ${stage.getParticipants().length} participants.`)

        socket.on(Events.stage.participants.state, (_, callback) => {
            callback(stage.getMinimalParticipants(socket.id));
        });

        socket.on(Events.stage.mediasoup.producers.state, async ({ }, callback) => {
            const response: MediasoupProducerResponse[] = stage.getMsProducers();
            callback(response);
        });

        socket.on('disconnect', () => {
            this.logger.info(`removing user ${participant.user.uid} from Stage`);
            stage.removeParticipant(participant);
        });

        return stage;
    }

    public async handleStageCreate(socket: SocketIO.Socket, data: StageCreatePayload) {
        this.logger.info("create-stage()");
        const decodedIdToken = await this.firebase.admin
            .auth()
            .verifyIdToken(data.token);

        //TODO: Add role management by verifying permission to create stage
        const docRef = await this.firebase.admin
            .firestore()
            .collection("stages")
            .add({
                name: data.stageName,
                type: data.type,
                password: data.password,
                directorUid: decodedIdToken.uid,
            });

        const stageId = docRef.id;

        const user = await this.firebase.admin
            .auth()
            .getUser(decodedIdToken.uid);

        

        const stage = this.createStage(stageId);

        await this.joinStageAndInitializeAllServices(socket, stageId, user);

        return {
            stage: {
                ...docRef,
                id: stageId,
            },
            participants: stage.getMinimalParticipants(),
            msProducers: stage.getMsProducers(),
        };
    }

    public async handleStageJoin(socket: SocketIO.Socket, data: StageJoinPayload) {
        this.logger.info("join-stage()");
        const decodedIdToken = await this.firebase.admin
            .auth()
            .verifyIdToken(data.token);

        //TODO: Add role management by verifying access to stage
        const doc = await this.firebase.admin
            .firestore()
            .collection("stages")
            .doc(data.stageId)
            .get();

        if (doc.exists) {
            const docData = doc.data();
            if (docData.password === data.password) { // no hashing?
                const user = await this.firebase.admin
                    .auth()
                    .getUser(decodedIdToken.uid);

                const stage = await this.joinStageAndInitializeAllServices(socket, data.stageId, user);
                this.logger.info(`user ${user.uid} joined stage ${data.stageId}`);

                return {
                    stage: {
                        ...docData,
                        id: data.stageId,
                    },
                    participants: stage.getMinimalParticipants(),
                    msProducers: stage.getMsProducers(),
                };
            } else {
                this.logger.warn(`user entered wrong password`);
                return { error: "Wrong password" };
            }
        } else {
            this.logger.warn(`user tried to join unavailable stage: ${data.stageId}`);
            return { error: "Could not find stage" };
        }
    }

    private createStage(stageId: string): Stage {
        const stage = new Stage();

        // stage.events
        //     .subscribe(event =>
        //         event.sender
        //             .broadcast
        //             .to(event.stageId)
        //             .emit(`stg/${event.action}`, event.payload)
        //     );

        this.stages[stageId] = stage;
        return stage;
    }
}
