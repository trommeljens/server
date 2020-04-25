import * as firebase from 'firebase-admin';
import { Consumer } from "mediasoup/lib/Consumer";
import { Producer } from "mediasoup/lib/Producer";
import { Router } from "mediasoup/lib/Router";
import { WebRtcTransport } from "mediasoup/lib/WebRtcTransport";
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import { reduce, tap, map } from 'rxjs/operators';

import { Events } from './events';

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

export interface MediasoupClient {
    user: firebase.auth.UserRecord;
    producer: BehaviorSubject<Producer[]>;
    transports: { [key: string]: WebRtcTransport };
    consumers: { [key: string]: Consumer };
    router: Router;
}

export interface MediasoupClientAnnouncement {
    userId: string;
    producer: Producer[];
    transports: WebRtcTransport[];
    consumers: Consumer[];
}

export interface MediasoupClientProducerAnnouncement {
    userId: string;
    producer: Producer[];
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

        // subscribe AFTER announcing self
        const participantsSub = this.participantAnnouncements
            .subscribe(participants =>
                participant.socket.emit(
                    Events.stage.participants,
                    participants
                        .filter(p => p.socketId !== participant.socket.id)
                )
            );

        // handle potential requests
        participant.socket.on(Events.stage.participants, () => {
            participant.socket.emit(
                Events.stage.participants,
                this.participants.value
            );
        });

        participant.socket.once('disconnect', () => // TODO: check event
            participantsSub.unsubscribe()
        );
    }

    close() {
        this.subs.forEach(sub => sub && sub.unsubscribe());
    }
}
