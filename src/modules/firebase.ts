import { Injectable, OnInit, InjectConfiguration } from "@hacker-und-koch/di";
import { Logger } from "@hacker-und-koch/logger";
import firebaseAdmin from "firebase-admin";
import { app as adminApp, firestore } from "firebase-admin";
import { Subject, Observable } from 'rxjs';
import { ChangeAccumulator, ChangeAccumulatorEvent } from "./change-accumulator";

const serviceAccount = require("../../firebase-adminsdk.json");

@Injectable()
export class Firebase implements OnInit {
    public admin: adminApp.App;

    @InjectConfiguration({ translators: {} })
    private config: { translators: any[] };

    private snapListeners: { [collection: string]: ChangeAccumulator } = {
        'stages': new ChangeAccumulator(),
    };

    constructor(private logger: Logger) {

    }

    async onConfigure() {
        // Initialize firebase
        const config = {
            credential: firebaseAdmin.credential.cert(serviceAccount),
            databaseURL: "https://digitalstage-wirvsvirus.firebaseio.com",
        };

        this.admin = firebaseAdmin.initializeApp(config);
    }

    async onInit() {
        for (let collection in this.snapListeners) {
            this.admin.firestore()
                .collection(collection)
                .onSnapshot(snapshot => this.snapListeners[collection].next(snapshot));
        }
    }

    async onReady() {
        // setInterval(() => {
        //     this.admin.firestore().collection('stages')
        //         .doc('W4kiyue8wRaZiRErZmv1')
        //         .update({ 'name': new Date(Date.now()).toISOString() })
        // }, 2e3);
    }

    newEntity(collection: string, initialState: any) {
        return this.admin.firestore()
            .collection(collection)
            .add(initialState);
    }

    snapshotsOfCollection(collection: string): Observable<ChangeAccumulatorEvent> {
        return this.snapListeners[collection]
            .events;
    }
}
