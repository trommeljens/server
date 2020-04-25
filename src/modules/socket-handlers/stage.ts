import { Injectable, OnInit } from "@hacker-und-koch/di";
import { Logger } from "@hacker-und-koch/logger";
import * as firebase from 'firebase-admin';
import { BehaviorSubject, Subject } from 'rxjs';
import { reduce, tap, map } from 'rxjs/operators';

import { Mediasoup } from "./mediasoup";
import { WebRTC } from "./web-rtc";
import { Soundjack } from "./soundjack";
import { Firebase } from "../firebase";
import { Events } from './events';

export interface Collector<T> {
    data: T;
    action: 'add' | 'remove';
}

export interface StageParticipant {
    user: firebase.auth.UserRecord;
    socket: SocketIO.Socket;
    stageId: string;
}

export interface StageParticipantAnnouncement {
    userId: string;
    name: string;
    socketId: string;
}

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
export class Stage {

    private participants: BehaviorSubject<StageParticipant[]> = new BehaviorSubject([]);
    private participantCollector: Subject<Collector<StageParticipant>> = new Subject();
    private participantAnnouncements: Subject<StageParticipantAnnouncement[]> = new Subject();


    constructor(
        private mediasoup: Mediasoup,
        private webRtc: WebRTC,
        private soundjack: Soundjack,
        private firebase: Firebase,
        private logger: Logger,
    ) {

        this.participantCollector
            .pipe(
                tap(event => {
                    if (event.action === "add") {
                        event.data.socket.join(event.data.stageId);
                    }
                }),
                reduce((acc: StageParticipant[], cur: Collector<StageParticipant>) => {
                    if (cur.action === 'add') {
                        acc.push(cur.data);
                    }
                    return acc;
                }, []),
            )
            .subscribe(this.participants);

        this.participants
            .pipe(
                map(participants =>
                    participants.map(participant => ({
                        userId: participant.user.uid,
                        name: participant.user.displayName,
                        socketId: participant.socket.id,
                    } as StageParticipantAnnouncement))
                )
            )
            .subscribe(this.participantAnnouncements);
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

        const user = await this.firebase.admin
            .auth()
            .getUser(decodedIdToken.uid);

        await this.joinStageAndInitializeAllServices(socket, docRef.id, user)

        return docRef.id;
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

    public async joinStageAndInitializeAllServices(socket: SocketIO.Socket, stageId: string, user: firebase.auth.UserRecord) {

        await this.webRtc.connectSocketToStage(socket, stageId, user.uid);
        await this.mediasoup.connectSocketToStage(socket, stageId, user.uid);
        await this.soundjack.connectSocketToStage(socket, stageId, user.uid);

        this.logger.info(`announcing added client ${user.uid} `);

        this.participantCollector.next({
            data: { user, socket, stageId },
            action: 'add',
        });
        
        // subscribe AFTER announcing self
        const participantsSub = this.participantAnnouncements
            .subscribe(participants => socket.emit(Events.stage.participants, participants));

        // handle request
        socket.on(Events.stage.participants, () => {
            socket.emit(Events.stage.participants, this.participants.value);
        });

        socket.once('disconnect', () => participantsSub.unsubscribe()); // TODO: check event
    }

}
