import * as firebase from 'firebase-admin';
import { Subject } from 'rxjs';

// import { Events, BusEvent } from './events';
import { MediasoupClient } from '../connectors';

export interface StageParticipant {
    user: firebase.auth.UserRecord;
    socket: SocketIO.Socket;
    stageId: string;
    mediasoupClient: MediasoupClient;
}

export interface StageParticipantAnnouncement {
    userId: string;
    name: string;
    socketId: string;
}

export declare type StageAction 
    = 'participant/added'
    | 'participant/removed'
    | 'participants/state'
    | 'ms/producer/added'
    | 'ms/producer/removed'
    | 'ms/producers/state';


export class Stage {

    private participants: StageParticipant[] = [];

    constructor() {

    }

    public addParticipant(participant: StageParticipant) {
        participant.socket.join(participant.stageId);

        // this.events.next({
        //     action: 'participant/added',
        //     sender: participant.socket,
        //     stageId: participant.stageId,
        //     payload: {
        //         userId: participant.user.uid,
        //         name: participant.user.displayName,
        //         socketId: participant.socket.id,
        //     }
        // });

        this.participants.push(participant);
    }

    public removeParticipant(participant: StageParticipant) {
        this.participants
            .map((part, i) => part.user.uid === participant.user.uid ? i : null)
            .filter(x => x !== null)
            .reverse()
            .forEach(i => this.participants.splice(i, 1));
        
        // this.events.next({
        //     action: 'participant/removed',
        //     sender: participant.socket,
        //     stageId: participant.stageId,
        //     payload: {
        //         userId: participant.user.uid,
        //         name: participant.user.displayName,
        //         socketId: participant.socket.id,
        //     }
        // });
    }

    getMinimalParticipants(blacklistSocketId?: string): StageParticipantAnnouncement[] {
        return this.getParticipants(blacklistSocketId)
            .map(participant => ({
                name: participant.user.displayName,
                userId: participant.user.uid,
                socketId: participant.socket.id,
            }));
    }

    getParticipants(blacklistSocketId?: string) {
        if (typeof blacklistSocketId !== 'undefined') {
            return this.participants.filter(participant => participant.socket.id !== blacklistSocketId);
        }

        return [...this.participants];
    }

    getMsProducers(blacklistSocketId?: string) {
        return this.getParticipants(blacklistSocketId)
            .map(p => ({
                userId: p.user.uid,
                producer: p.mediasoupClient
                    .producer
                    .map(p => p.id),
            }));
    }
}
