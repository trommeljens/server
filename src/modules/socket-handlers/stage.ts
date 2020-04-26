import * as firebase from 'firebase-admin';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import { reduce, tap, map } from 'rxjs/operators';

import { Events } from './events';
import { MediasoupProducerResponse, MediasoupClient } from './mediasoup';

export interface Collector<T> {
    data: T;
    action: 'add' | 'remove';
}

export interface StageParticipant {
    user: firebase.auth.UserRecord;
    socket: SocketIO.Socket;

    mediasoupClient: MediasoupClient;

    stageId: string;
}

export interface StageParticipantAnnouncement {
    userId: string;
    name: string;
    socketId: string;
}

export class Stage {

    private participants: BehaviorSubject<StageParticipant[]> = new BehaviorSubject([]);
    private participantCollector: Subject<Collector<StageParticipant>> = new Subject();

    private subs: Subscription[] = [];

    constructor() {
        const participantsSub = this.participantCollector
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

        this.subs.push(participantsSub);
    }

    public addParticipant(participant: StageParticipant) {
        this.participantCollector.next({
            action: 'add',
            data: participant,
        });

        const subs: Subscription[] = [];

        participant.socket.broadcast
            .to(participant.stageId)
            .emit(
                Events.stage.participants.added,
                {
                    name: participant.user.displayName,
                    userId: participant.user.uid,
                    socketId: participant.socket.id,
                    stageId: participant.stageId,
                } as StageParticipantAnnouncement
            );


        participant.socket.once('disconnect', () => // TODO: check event
            subs.forEach(sub => sub && sub.unsubscribe())
        );
    }

    getMinimalParticipants(blacklistSocketId?: string): StageParticipantAnnouncement[] {
        return this.getParticipants(blacklistSocketId)
            .map(participant => ({
                name: participant.user.displayName,
                userId: participant.user.uid,
                socketId: participant.socket.id,
            }))
    }

    getParticipants(blacklistSocketId?: string) {
        if (typeof blacklistSocketId !== 'undefined') {
            return this.participants.value.filter(participant => participant.socket.id !== blacklistSocketId);
        }

        return this.participants.value;
    }

    close() {
        this.subs.forEach(sub => sub && sub.unsubscribe());
    }
}
