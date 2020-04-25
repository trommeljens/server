import { Application, OnReady } from '@hacker-und-koch/di';
import { Logger } from '@hacker-und-koch/logger';

import { 
    HttpServer,
    Firebase,
    Mediasoup,
    WebRTC,
    Soundjack,
    SocketHandler,
} from './modules';

@Application({
    declarations: [
        Firebase,
        Mediasoup,
        WebRTC,
        Soundjack,
        SocketHandler,
        HttpServer,
    ],
})
export class App implements OnReady {
    constructor(
        private server: HttpServer, // required force creation of an instance
        private logger: Logger
    ) {

    }

    onInit() {

    }

    onReady() {
        this.logger.log('ready');
    }
}
