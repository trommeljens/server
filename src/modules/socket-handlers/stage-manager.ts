import { Injectable, OnInit } from "@hacker-und-koch/di";
import { Logger } from "@hacker-und-koch/logger";
import * as firebase from 'firebase-admin';

import { Mediasoup } from "./mediasoup";
import { WebRTC } from "./web-rtc";
import { Soundjack } from "./soundjack";
import { Firebase } from "../firebase";
import { Stage } from "./stage";

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

    public async joinStageAndInitializeAllServices(
        socket: SocketIO.Socket,
        stageId: string,
        user: firebase.auth.UserRecord
    ) {
        const [_, mediasoupClient] = await Promise.all([
            this.webRtc.connectSocketToStage(socket, stageId, user.uid),
            this.mediasoup.connectSocketToStage(socket, stageId, user),
            this.soundjack.connectSocketToStage(socket, stageId, user.uid),
        ]);

        if (typeof this.stages[stageId] === 'undefined') {
            throw new Error(`trying to add socket to non-existend stage ${stageId}`);
        }
        this.logger.info(`adding participant ${user.uid} to stage ${stageId}`);
        this.stages[stageId].addParticipant({
            user,
            socket,
            stageId,
            mediasoupClient,
        });
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
                directorUid: decodedIdToken.uid
            });

        const stageId = docRef.id;

        const user = await this.firebase.admin
            .auth()
            .getUser(decodedIdToken.uid);

        this.stages[stageId] = new Stage();

        await this.joinStageAndInitializeAllServices(socket, stageId, user)

        return stageId;
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

                await this.joinStageAndInitializeAllServices(socket, data.stageId, user);
                this.logger.info(`user ${user.uid} joined stage ${data.stageId}`);

                return {
                    stage: {
                        ...docData,
                        id: data.stageId
                    }
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

}
