import { Application, OnReady } from '@hacker-und-koch/di';
import { Logger } from '@hacker-und-koch/logger';

import { 
    HttpServer,
    Firebase,
} from './modules';

@Application({
    declarations: [
        HttpServer,
        Firebase,

    ],
})
export class App implements OnReady {
    constructor(
        private server: HttpServer,
        private logger: Logger
    ) {

    }

    onInit() {

    }

    onReady() {
        this.logger.log('ready');
    }
}
