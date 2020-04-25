import { Injectable, OnInit, OnConfigure } from "@hacker-und-koch/di";
import express, { Express } from "express";
import SocketIO from 'socket.io';
import cors from "cors";
import * as https from "https";
import { Server } from "https";
import { Logger } from "@hacker-und-koch/logger";
import * as fs from 'fs';

import { SocketHandler, BroadcastEvent } from "./socket-handler";

const timesyncServer = require("timesync/server"); // workaround for ts error

@Injectable()
export class HttpServer implements OnConfigure, OnInit {
    private expressApp: Express;
    private webServer: Server;
    private socketIO: SocketIO.Server;
    private config: any;

    constructor(
        private logger: Logger,
        private socketHandler: SocketHandler,
    ) { }

    async onConfigure(): Promise<void> {
        this.config = require("../config");
    }

    async onInit(): Promise<void> {
        this.createExpressApp();
        this.createWebServer();

        await new Promise(resolve => this.webServer.listen(this.config.listenPort, resolve));
        this.logger.log("Running digital stage on port " + this.config.listenPort + " ...");

        await this.initializeSocketCommunication();
        this.logger.log("Socket communication ready to please ;-)\nPlease world, tear down this serer enormous with your unlimited creativity!");
    }

    private createExpressApp() {
        // Create Express app
        this.expressApp = express();
        this.expressApp.use(cors({ origin: true }));
        this.expressApp.options("*", cors());
        this.expressApp.get("/", (req, res) => {
            res.status(200).send("Alive and kickin'");
        });
        this.expressApp.use("/timesync", timesyncServer.requestHandler);
    }

    private createWebServer() {
        // Create HTTPS
        this.webServer = https.createServer({
            key: fs.readFileSync(this.config.sslKey),
            cert: fs.readFileSync(this.config.sslCrt),
            ca: this.config.ca && fs.readFileSync(this.config.ca),
            requestCert: false,
            rejectUnauthorized: false
        }, this.expressApp);
    }

    private async initializeSocketCommunication(): Promise<void> {
        this.socketIO = SocketIO(this.webServer);
        this.socketIO.origins("*:*");
        this.socketIO.on("connection", socket => this.socketHandler.handle(socket));
        this.socketHandler.broadcastEvents
            .subscribe((event: BroadcastEvent) => {
                this.socketIO.emit(event.action, event.issuer.id);
            });
    }
}
