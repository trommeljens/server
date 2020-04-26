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

export declare type StageAction = 'participant/added'
    | 'participant/removed'
    | 'participants/state'
    | 'ms/producer/added'
    | 'ms/producer/removed'
    | 'ms/producers/state';

export declare interface StageEvent<T> {
    action: StageAction;
    sender: SocketIO.Socket;
    stageId: string;
    payload: T;
}

export class Stage {

    private participants: BehaviorSubject<StageParticipant[]> = new BehaviorSubject([]);
    private participantCollector: Subject<Collector<StageParticipant>> = new Subject();

    public events: Subject<StageEvent<any>> = new Subject();

    private subs: Subscription[] = [];

    constructor() {
        const participantsSub = this.participantCollector
            .pipe(
                tap(event => {
                    if (event.action === 'add') {
                        event.data.socket.join(event.data.stageId);
                    }
                }),
                tap(event => {
                    if (event.action === 'add') {
                        this.events.next({
                            action: 'participant/added',
                            sender: event.data.socket,
                            stageId: event.data.stageId,
                            payload: {
                                userId: event.data.user.uid,
                                name: event.data.user.displayName,
                                socketId: event.data.socket.id,
                            }
                        });
                    } else if (event.action === 'remove') {
                        this.events.next({
                            action: 'participant/removed',
                            sender: event.data.socket,
                            stageId: event.data.stageId,
                            payload: {
                                userId: event.data.user.uid,
                                name: event.data.user.displayName,
                                socketId: event.data.socket.id,
                            }
                        });
                    }
                }),
                reduce((acc: StageParticipant[], cur: Collector<StageParticipant>) => {
                    if (cur.action === 'add') {
                        acc.push(cur.data);
                    }
                    return acc;
                }, [])
            )
            .subscribe(this.participants);

        this.subs.push(participantsSub);
    }

    public addParticipant(participant: StageParticipant) {
        this.participantCollector.next({
            action: 'add',
            data: participant,
        });
    }

    public removeParticipant(participant: StageParticipant) {
        this.participantCollector.next({
            action: 'remove',
            data: participant,
        });
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
