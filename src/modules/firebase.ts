import { Injectable, OnInit } from "@hacker-und-koch/di";
import firebase from "firebase-admin";
import { app } from "firebase-admin";

const serviceAccount = require("../../firebase-adminsdk.json");

@Injectable()
export class Firebase implements OnInit {
    public admin: app.App;

    async onInit() {

        // Initialize firebase
        this.admin = firebase.initializeApp({
            credential: firebase.credential.cert(serviceAccount),
            databaseURL: "https://digitalstage-wirvsvirus.firebaseio.com"
        });
    }

}
