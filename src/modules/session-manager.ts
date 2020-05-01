import { Injectable } from "@hacker-und-koch/di";
import { Firebase } from "./firebase";
import { hostname } from "os";
import { firestore } from 'firebase-admin';
import { Z_DATA_ERROR } from "zlib";
import { Logger } from "@hacker-und-koch/logger";

@Injectable()
export class SessionManager {
    private hostname = hostname();

    private clearSessionsAfterSec = 60 * 2;
    private stopClearingSessions = false;

    constructor(
        private firebase: Firebase,
        private logger: Logger,
    ) {

    }

    onInit() {
        this.clearAbandonedSessions();
    }

    async clearAbandonedSessions() {
        if (!this.stopClearingSessions) {
            const query = await this.firebase.admin
                .firestore()
                .collection('sessions')
                .where('abandonedAt', '>', 0)
                .where('abandonedAt', '>=', Date.now() - this.clearSessionsAfterSec * 1e3)
                .get();


            if (query.docs.length) {
                this.logger.log(`removing ${query.docs.length} abandoned sessions`);
                await Promise.all(
                    query.docs.map(doc =>
                        doc.ref.delete()
                    )
                );
            } else {
                this.logger.log(`did not find any abandoned sessions`);
            }

            await new Promise(resolve =>
                setTimeout(resolve, this.clearSessionsAfterSec / 2 * 1e3)
            );

            this.clearAbandonedSessions();
        }

    }

    async getSession(token: string, socketId: string): Promise<{ id: string }> {
        const user = await this.firebase.admin
            .auth()
            .verifyIdToken(token);

        const existingSession = await this.firebase.admin.firestore()
            .collection('sessions')
            .where('user', '==', user.uid)
            .get();
        if (existingSession.docs.length) {
            const doc = existingSession.docs[0];
            await doc.ref.update({
                socketId: socketId,
                abandonedAt: 0,
            });
            return {
                id: doc.id,
            };
        } else {
            const newSession = await this.firebase.admin.firestore()
                .collection('sessions')
                .add({
                    socketId,
                    user: user.uid,
                    host: this.hostname,
                    abandonedAt: 0,
                });

            return {
                id: newSession.id,
            };
        }
    }

    async announceDisconnect(socketId: string) {
        const sessions = await this.firebase.admin
            .firestore()
            .collection('sessions')
            .where('socketId', '==', socketId)
            .get();
        if (sessions.docs.length) {
            sessions.docs[0].ref.update({
                abandonedAt: Date.now(),
            });
        }
    }

    async onDestroy() {
        await Promise.all(
            (await this.firebase.admin.firestore()
                .collection('sessions')
                .where('host', '==', this.hostname)
                .get()
            ).docs.map(doc =>
                doc.ref.update({ abandonedAt: Date.now() })
            )
        );
    }
}
