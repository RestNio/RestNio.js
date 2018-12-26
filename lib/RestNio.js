/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

const Router = require('./routes/Router');
const Preparator = require('./routing/Preparator');
const Http = require('http');
const WebSocket = require('ws');

/**
 * @class RestNio
 * @classdesc
 * Server driver for a REST and websocket interface.
 * @constructor
 * @param {int} port the port for the server to bind on.
 * @param {security} security security settings to use.
 * @param {url} path the relative path to check requests at.
 */
class RestNio {

    constructor(port, security, router, path = '', doWebsocket = true) {
        this.version = require('../package.json').version;
        this.port = port;
        this.security = security;
        this.path = path;
        this.routes = new Map();
        this.subscriptions = new Map();
        this.doWebsocket = doWebsocket;

        // Initialise the main router.
        router(new Router(this, path));

        // Initialise the & prepare the http and websocket server.
        this.httpServer = Http.createServer();
        Preparator.registerHttpServer(this.httpServer, this.routes);
        if (doWebsocket) {
            this.wsServer = new WebSocket.Server({server: this.httpServer});
            Preparator.registerWsServer(this.wsServer, this.routes);
        }
    }

    bind() {
        this.httpServer.listen(this.port);
    }

}
module.exports = RestNio;
module.exports.params = require('./params');