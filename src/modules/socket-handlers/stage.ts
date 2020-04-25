import { Injectable, OnInit } from "@hacker-und-koch/di";
import { Logger } from "@hacker-und-koch/logger";
import * as firebase from 'firebase-admin';
import { BehaviorSubject, Subject } from 'rxjs';
import { reduce, tap, map } from 'rxjs/operators';

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
    stageId: string;
}

export class Stage {

    public participants: BehaviorSubject<StageParticipant[]> = new BehaviorSubject([]);
    public participantCollector: Subject<Collector<StageParticipant>> = new Subject();
    public participantAnnouncements: Subject<StageParticipantAnnouncement[]> = new Subject();

    constructor() {
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
                        stageId: participant.stageId,
                    } as StageParticipantAnnouncement))
                )
            )
            .subscribe(x => this.participantAnnouncements);
    }

    public addParticipant(participant: StageParticipant) {
        this.participantCollector.next({
            action: 'add',
            data: participant,
        });

        // subscribe AFTER announcing self
        const participantsSub = this.participantAnnouncements
            .subscribe(participants => participant.socket.emit(Events.stage.participants, participants));

        // handle request
        participant.socket.on(Events.stage.participants, () => {
            participant.socket.emit(Events.stage.participants, this.participants.value);
        });

        participant.socket.once('disconnect', () => participantsSub.unsubscribe()); // TODO: check event
    }
}
