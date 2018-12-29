/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

// Imports
const HttpClient = require('./client/HttpClient');
const WebSocketClient = require('./client/WebSocketClient');
const Router = require('./routes/Router');
const Token = require('./security/Token');
const Http = require('http');
const WebSocket = require('ws');
const params = require('./params'); 

/**
 * @class RestNio
 * @classdesc
 * Server driver for a REST and websocket interface.
 */
class RestNio {

    /**
     * Constructs a new RestNio server.
     * @param {int} port the port for the server to bind on.
     * @param {Function} router function router to accept the root router.
     * @param {any} security security settings to use.
     * @param {url} path the relative path to check requests at.
     * @param {boolean} doWebsocket wether or not to host websocket service. 
     */
    constructor(port, router, security, path = '', doWebsocket = true, wsMotd) {
        this.version = require('../package.json').version;
        this.params = params; // Expose default params for easy access.
        this.port = port;
        this.security = security;
        this.path = path;
        this.router = new Router(this, path);
        this.routes = new Map();
        this.subscriptions = new Map();
        this.doWebsocket = doWebsocket;
        this.wsMotd = wsMotd;

        // Initialise the security system.
        this.token = new Token(security);

        // Initialise the & prepare the http and websocket server.
        this.httpServer = Http.createServer();
        this.httpServer.on('request', (request, response) => new HttpClient(this, request, response));
        if (doWebsocket) {
            this.wsServer = new WebSocket.Server({server: this.httpServer});
            this.wsServer.on('connection', ws => new WebSocketClient(this, ws));
            this.router.ws('/upgrade');
        }

        // Initialise the main router.
        router(this.router, this);
    }

    bind() {
        this.httpServer.listen(this.port);
    }

}
// Expose default params staticly too.
RestNio.params = params;
module.exports = RestNio;