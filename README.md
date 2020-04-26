# ANNOUNCEMENT

Hey,

we are currently reorganzing our code during the EU Hackathon #EuVsVirus.
For this we move code fragments part by part from the former repository at:
https://github.com/delude88/digitalstage-mediasoup

And we need your Help!

So we add some comments like

    //TODO: Implement this feature here
    
as single work packets for the communicty.

We will use this readme for updates in the upcoming week during the hackatlon.
And join us on the #EuVsVirus channel:

https://euvsvirus.slack.com/archives/C011PTXA9U7

and get in contact :)

Together we fight corona!

# Digital Stage Server Application

This is the web client implementation of the Digital Stage Project, written in Typescript and using mainly
 - Node.js
 - Socket.io
 - Mediasoup
 - Google Firebase
 
 Please participante and help us developing this solution right now at
 
    #WirVsVirus
     
    #EUvsVirus

## Requirements

Since we are using node.js, npm and mediasoup you need to have the following frameworks installed first:

### Linux, Unix or macos
- node version >= v8.6.0
- python version 2 or 3
- make
- gcc and g++ >= 4.9 or clang

### Windows

- node version >= v8.6.0
- python version 2
- Visual Studio >= 2015

For more information please see: https://mediasoup.org/documentation/v3/mediasoup/installation/

## Install

To get started, checkout the repository and install all dependencies first:

    git clone https://github.com/digita-stage/server.git
    cd server
    npm install
    
Then you can start the server by using

    npm dev
    
The server is then running on port 3001    


# Socket events
_(s=server, c=client, *=all stage clients, c>s>c=request)_

## Stage - `stg/*`
* c>s `stg/create`
```typescript
// client payload
interface StageCreatePayload {
    token: string;
    stageName: string;
    type: "theater" | "music" | "conference";
    password: string;
}
```

* c>s `stg/join`
```typescript
// client payload
interface StageJoinPayload {
    token: string;
    stageId: string;
    password: string;
}
```
* c>s>c `stg/participants`
```typescript
// server payload
interface StageParticipantAnnouncement {
    userId: string;
    name: string;
    socketId: string;
}[]
```
* s>* `stg/participant-added`
```typescript
// server payload
interface StageParticipantAnnouncement {
    userId: string;
    name: string;
    socketId: string;
}
```
### WebRTC - `stg/p2p/*`
* s>* `stg/p2p/peer-added`
* c>s `stg/p2p/make-offer`
* s>c `stg/p2p/offer-made`
* c>s `stg/p2p/make-answer`
* s>c `stg/p2p/answer-made`
* c>s `stg/p2p/send-candidate`
* s>c `stg/p2p/candidate-sent`

### Soundjack - `stg/sj/*`
* c>s `stg/sj/send-ip`
```typescript
interface ClientIpPayload {
    ip: string;
    port: number;
}
```

* s>c `stg/sj/ip-sent`
```typescript
interface ServerIpPayload {
    uid: string;
    ip: string;
    port: number;
}
```

### Mediasoup - `stg/ms/*`
* c>s>c `stg/ms/get-rtp-capabilities`
* c>s>c `stg/ms/create-send-transport`
* c>s>c `stg/ms/create-send-transport`
* c>s>c `stg/ms/create-receive-transport`
* c>s>c `stg/ms/connect-transport`
* c>s>c `stg/ms/send-track`
* c>s>c `stg/ms/consume`
* c>s>c `stg/ms/finish-consume`

* s>* `stg/ms/producer/update`
```typescript
interface MediasoupProducerAnnouncement {
    userId: string;
    producer: Producer[];
}
```
* c>s>c `stg/ms/producer/all`
```typescript
// Server response
interface MediasoupProducerAnnouncement {
    userId: string;
    producer: Producer[];
}[]
```