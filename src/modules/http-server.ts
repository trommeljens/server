import { Injectable, OnInit, OnConfigure } from "@hacker-und-koch/di";
import SocketIO from "socket.io";
import express, { Express } from "express";
import cors from "cors";
import * as https from "https";
import { Server } from "https";
import { Firebase } from "./firebase";
import { Logger } from "@hacker-und-koch/logger";
import * as fs from 'fs';

const timesyncServer = require("timesync/server"); // workaround for ts error
const config = require("../config");

@Injectable()
export class HttpServer implements OnConfigure, OnInit {
    private expressApp: Express;
    private webServer: Server;

    constructor(private firebase: Firebase, logger: Logger) {

    }

    onConfigure(): Promise<void> {
        // Create Express app
        this.expressApp = express();
        this.expressApp.use(cors({ origin: true }));
        this.expressApp.options("*", cors());
        this.expressApp.get("/", (req, res) => {
            res.status(200).send("Alive and kickin'");
        });
        this.expressApp.use("/timesync", timesyncServer.requestHandler);

        // Create HTTPS
        this.webServer = https.createServer({
            key: fs.readFileSync(config.sslKey),
            cert: fs.readFileSync(config.sslCrt),
            ca: config.ca && fs.readFileSync(config.ca),
            requestCert: false,
            rejectUnauthorized: false
        }, this.expressApp);

        return;
    }


    onInit(): Promise<void> {
        return;
    }

}