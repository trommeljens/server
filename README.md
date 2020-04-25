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
* s>* `stg/client-added`
* c>s `stg/create`
* c>s `stg/join`

## Connections - `con/*`
### WebRTC - `con/p2p/*`
* s>* `con/p2p/peer-added`
* c>s `con/p2p/make-offer`
* s>c `con/p2p/offer-made`
* c>s `con/p2p/make-answer`
* s>c `con/p2p/answer-made`
* c>s `con/p2p/send-candidate`
* s>c `con/p2p/candidate-sent`

### Soundjack - `con/sj/*`
* c>s `con/sj/send-ip`
* s>c `con/sj/ip-sent`

### Mediasoup - `con/ms/*`
* c>s>c `con/ms/get-rtp-capabilities`
* c>s>c `con/ms/create-send-transport`
* c>s>c `con/ms/create-send-transport`
* c>s>c `con/ms/create-receive-transport`
* c>s>c `con/ms/connect-transport`
* c>s>c `con/ms/send-track`
* c>s>c `con/ms/consume`
* c>s>c `con/ms/finish-consume`
