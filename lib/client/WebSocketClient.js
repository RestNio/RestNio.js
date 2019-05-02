/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

// Imports
require('../RestNio');
const Parser = require('../routing/Parser');
const Client = require('./Client');
/**
 * Typedef Imports
 * @typedef {import("../RestNio")} RestNio
 */

/**
 * @class WebSocketClient
 * @extends Client
 * @author 7kasper
 * @classdesc
 * Represents a websocket client. 
 * A websocket client is backed by an
 * open websocket connection.
 * Unlike the http connection, this
 * client isn't restfull and can have
 * information stored on it, and
 * be subsribed to topics.
 */
class WebsocketClient extends Client {

    /**
     * Creates a new WebsocketClient instance.
     * @param {RestNio} restnio
     * @param {websocket} ws
     */
    constructor(restnio, ws) {
        super('ws');
        this.ws = ws;
        this.isAlive = true;
        this.setupKeepAlive(restnio);
        this.setupRouting(restnio);
        this.motd(restnio);
    }

    //=====================================================\\
    //				       Communications	       	   	   \\
    //=====================================================\\

    motd(restnio) {
        if (restnio.options.websocket.motd) {
            Promise.resolve(restnio.options.websocket.motd({}, this).then(res => this.obj(res)));
        }
    }

    str(str) {
        super.str(str);
        this.ws.send(str);
    }

    err(err, code = 500) {
        super.err(err, code);
        this.ws.send(JSON.stringify(err));
    }

    close() {
        super.close();
        this.ws.terminate();
    }

    //=====================================================\\
    //				            Setup	        	   	   \\
    //=====================================================\\

    /**
     * Sets up the keep alive on this websocket client.
     * Unlike http, websocket connections
     * remain open until one party closes
     * it. To prevent connections from
     * freezing, we ping on interval.
     * The client is disconnected if
     * it doesn't pong us back.
     * @param {RestNio} restnio 
     */
    setupKeepAlive(restnio) {
        this.ws.on('pong', () => {
            this.isAlive = true;
        });
        setInterval(() => {
            if (!this.isAlive) {
                this.close();
            } else {
                this.isAlive = false;
                this.ws.ping();
            }
        }, restnio.options.websocket.timeout);
    }

    /**
     * Performs the tokencheck from websocket request if present.
     * Unlike http connections wich are RESTfull, websockets
     * can be upgraded once and their permissions will remain.
     * This means a client can send a token just once.
     * @param {RestNio} restnio 
     */
    tokenCheck(restnio, request) {
        if (request.token && restnio.options.auth.type == 'jwt') 
            this.grantPermWithToken(request.token, restnio);
    }

    /**
     * Setup the websocket routing thingy.
     * @param {RestNio} restnio 
     */
    setupRouting(restnio) {
        this.ws.on('message', message => {
            let request = JSON.parse(message);
            if (!request.path) request.path = '/';
            this.tokenCheck(restnio, request);
            let routename = 'WS:' + request.path;
            this.run(routename, restnio.routes, 
                Parser.parseFullWsParams, request);
        });
    }

}
module.exports = WebsocketClient;