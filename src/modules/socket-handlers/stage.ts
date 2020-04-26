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
    public participantCollector: Subject<Collector<StageParticipant>> = new Subject();

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

        // allow to query all mediasoup producers
        participant.socket.on(Events.stage.mediasoup.producer.all, async ({ }, callback) => {
            const response: MediasoupProducerResponse[] = this.participants
                .getValue()
                .filter(p => participant.socket !== p.socket)
                .map(p => ({
                    userId: p.user.uid,
                    producer: p.mediasoupClient.producer.value,
                }));

            callback(response);
        });


        participant.socket.once('disconnect', () => // TODO: check event
            subs.forEach(sub => sub && sub.unsubscribe())
        );
    }

    getParticipants(blacklistSocketId?: string): StageParticipantAnnouncement[] {
        let participants = this.participants.value;
        if (typeof blacklistSocketId !== 'undefined') {
            participants = this.participants.value.filter(participant => participant.socket.id !== blacklistSocketId);
        }

        return participants.map(participant => ({
            name: participant.user.displayName,
            userId: participant.user.uid,
            socketId: participant.socket.id,
        }))
    }

    close() {
        this.subs.forEach(sub => sub && sub.unsubscribe());
    }
}
