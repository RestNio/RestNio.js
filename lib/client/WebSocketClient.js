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
     * @param {ClientProperties} [props] - optional extra client properties.
     */
    constructor(restnio, ws, props = {}) {
        super('ws', restnio, _.defaultsDeep(props, 
            restnio.options.default.wsProperties));
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
            this.executeRoute(restnio.options.websocket.motd, {});
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
                this.ws.ping(()=>{});
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
    async tokenCheck(restnio, request) {
        if (request.token && restnio.options.auth.type == 'jwt') 
            await this.grantPermWithToken(request.token, restnio);
    }

    /**
     * Setup the websocket routing thingy.
     * @param {RestNio} restnio 
     */
    setupRouting(restnio) {
        this.ws.on('message', message => {
            this.routeBeat(restnio, message);
        });
    }

    /**
     * Async RouteBeat.
     * @param {RestNio} restnio 
     * @param {string} message 
     */
    async routeBeat(restnio, message) {
        try {
            let request = JSON.parse(message);
            if (typeof request !== 'object') {
                request = {params: {body: request}};
            }
            if (!request.path) request.path = '/';
            await this.tokenCheck(restnio, request);
            let routename = 'WS:' + request.path;
            await this.run(routename, restnio.routes, 
                Parser.parseFullWsParams, request);
        } catch (err) {
            this.throwErr(err);
        }
    }

}
module.exports = WebsocketClient;