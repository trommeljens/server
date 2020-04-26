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
    stageId: string;
}

export class Stage {

    public participants: BehaviorSubject<StageParticipant[]> = new BehaviorSubject([]);
    public participantCollector: Subject<Collector<StageParticipant>> = new Subject();
    public participantAnnouncements: Subject<StageParticipantAnnouncement[]> = new Subject();

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

        const participantAnnouncementSub = this.participants
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
            .subscribe(this.participantAnnouncements);

        this.subs.push(participantsSub);
        this.subs.push(participantAnnouncementSub);
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
                    userId:  participant.user.uid,
                    socketId: participant.socket.id,
                    stageId: participant.stageId,
                } as StageParticipantAnnouncement
            );

        // handle requests
        participant.socket.on(Events.stage.participants.all, () => {
            participant.socket.emit(
                Events.stage.participants.all,
                this.participants.value
                    .filter(p => p.socket !== participant.socket)
            );
        });


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

    close() {
        this.subs.forEach(sub => sub && sub.unsubscribe());
    }
}
