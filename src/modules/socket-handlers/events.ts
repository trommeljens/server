export const Events = {
    stage: {
        create: 'stg/create',
        join: 'stg/join',
        participants: 'stg/participants',
        soundjack: {
            sendIp: 'stg/sj/send-ip',
            ipSent: 'stg/sj/ip-sent',
        },
        mediasoup: {
            producer: {
                update: 'stg/ms/producer/update',
                all: 'stg/ms/producer/all',
            }
        }
    },

}
