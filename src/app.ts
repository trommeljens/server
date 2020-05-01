import { Application, OnReady } from '@hacker-und-koch/di';
import { Logger } from '@hacker-und-koch/logger';

import {
    HttpServer,
    Firebase,
    SocketHandler,
    SessionManager,
} from './modules';

@Application({
    declarations: [
        Firebase,
        HttpServer,
        SocketHandler,
        SessionManager,
    ],
})
export class App implements OnReady {
    constructor(
        private server: HttpServer, // required force creation of an instance
        private firebase: Firebase,
        private logger: Logger
    ) {

    }

    onInit() {

    }

    onReady() {
        this.logger.log('ready');

        this.firebase
            .snapshotsOfCollection('stages')
            .subscribe(event => {
                if (event.eventType == 'updated') {
                    this.logger
                        .log('update to "stages" document:', event.updated.map(id => event.plainSnap[id]));
                } else {
                    this.logger.log('Added:', event.added, '| Removed:', event.removed);
                }
            });

        this.firebase.newEntity('stages', {
            directorUid: 'foobarnotavailable',
            name: 'firebase-tests',
            type: 'theater'
        });
    }
}
