/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

// Imports
require('../RestNio');
const _ = require('lodash');
const Parser = require('../routing/Parser');
const Client = require('./Client');
/**
 * Typedef Imports
 * @typedef {import("../RestNio")} RestNio
 * @typedef {import("../util/Options").ClientProperties} ClientProperties
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
     * @param {RestNio} restnio - reference to the server.
     * @param {websocket} ws - the websocket object wrapping
     * @param {request} request - the http request object.
     * @param {ClientProperties} [props] - optional extra client properties.
     */
    constructor(restnio, ws, request, props = {}) {
        super('ws', restnio, request, _.defaultsDeep(props, 
            restnio.options.default.wsProperties));
        this.ws = ws;
        this.isAlive = true;
        this.setupKeepAlive();
        this.setupClose();
        this.setupRouting();
        this.motd();
        this.startBeat();
    }

    /**
     * Asyncly performs the startup of this client.
     */
    async startBeat() {
        await super.startBeat();
        // try {
        // } catch (err) {
        //     this.throwErr(err);
        // }
    }

    //=====================================================\\
    //				       Communications	       	   	   \\
    //=====================================================\\

    motd() {
        if (this.restnio.options.websocket.motd) {
            this.executeRoute(this.restnio.options.websocket.motd, {});
        }
    }

    str(str) {
        super.str(str);
        this.ws.send(str);
    }

    buf(buf) {
        super.buf(buf);
        this.ws.send(buf);
    }

    err(err, code = 500) {
        try {
            super.err(err, code);
            this.ws.send(JSON.stringify({
                code: code,
                error: err.toString()
            }));
        } catch (err) {
            if (this.props.logErrors) console.error(err);
        }
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
     */
    setupKeepAlive() {
        this.ws.on('pong', () => {
            this.isAlive = true;
        });
        let wsClient = this;
        function timeout() {
            if (!wsClient.isAlive) {
                wsClient.close();
            } else {
                wsClient.isAlive = false;
                wsClient.ws.ping(()=>{});
                setTimeout(timeout, wsClient.restnio.options.websocket.timeout)
            }
        }
        setTimeout(timeout, this.restnio.options.websocket.timeout)
    }

    /**
     * Sets up the action that happens when the websocket is externally closed.
     */
    setupClose() {
        this.ws.on('close', () => {
            super.close(); // Not this, because the connection is already terminated.
        });
    }

    /**
     * Performs the tokencheck from websocket request if present.
     * Unlike http connections wich are RESTfull, websockets
     * can be upgraded once and their permissions will remain.
     * This means a client can send a token just once.
     */
    async tokenCheck(request) {
        if (request.token && this.restnio.options.auth.type == 'jwt') 
            await this.grantPermWithToken(request.token);
    }

    /**
     * Setup the websocket routing thingy.
     */
    setupRouting() {
        this.ws.on('message', message => {
            this.routeBeat(message);
        });
    }

    /**
     * Async RouteBeat.
     * @param {string} message 
     */
    async routeBeat(message) {
        try {
            let request = JSON.parse(message);
            if (typeof request !== 'object') {
                request = {params: {body: request}};
            }
            if (!request.path) request.path = '/';
            await this.tokenCheck(request);
            let routename = 'WS:' + request.path;
            await this.run(routename, this.restnio.routes, 
                Parser.parseFullWsParams, request);
        } catch (err) {
            this.throwErr(err);
        }
    }

}
module.exports = WebsocketClient;