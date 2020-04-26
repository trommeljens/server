export interface BusEvent<A, T> {
    action: A;
    sender: SocketIO.Socket;
    stageId: string;
    payload: T;
}

export const Events = {
    stage: {
        create: 'stg/create',
        join: 'stg/join',
        participants: {
            state: 'stg/participants/state',
        },
        participant: {
            added: 'stg/participant/added',
            removed: 'stg/participant/removed',
        },
        soundjack: {
            sendIp: 'stg/sj/send-ip',
            ipSent: 'stg/sj/ip-sent',
        },
        mediasoup: {
            producer: {
                added: 'stg/ms/producer/added',
                removed: 'stg/ms/producer/removed',
            },
            producers: {
                state: 'stg/ms/producers/state',
            },
        },
        webRtc: {
            peer: {
                added: 'stg/p2p/peer-added',
                removed: 'stg/p2p/peer-removed',
            },
            offer: {
                make: 'stg/p2p/make-offer',
                made: 'stg/p2p/offer-made',
            },
            answer: {
                make: 'stg/p2p/make-answer',
                made: 'stg/p2p/answer-made',
            },
            candidate: {
                send: 'stg/p2p/send-candidate',
                sent: 'stg/p2p/candidate-sent',
            },
        },
    },
}
