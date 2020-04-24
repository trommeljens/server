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
