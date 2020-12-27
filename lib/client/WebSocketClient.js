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
        this.isActive = true;
        this.isAlive = false;
        this.setupKeepAlive();
        this.setupClose();
        this.setupRouting();
        this.startBeat();
    }

    /**
     * Asyncly performs the startup of this client.
     */
    async startBeat() {
        await super.startBeat();
        this.isAlive = true;
        await this.motd();
        // try {
        // } catch (err) {
        //     this.throwErr(err);
        // }
    }

    //=====================================================\\
    //				       Communications	       	   	   \\
    //=====================================================\\

    async motd() {
        for (let motd of this.restnio.routes.get('wsConnect').routes) {
            try { await this.executeRoute(motd, {}); }
            catch(err) { if (this.props.logErrors) console.error(err); }
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

    /**
     * Calls all websocket onClose handlers.
     * They only get executed once on closure.
     * @param {*} reason reason for closing.
     */
    async callWSClose(reason) {
        if (this.isAlive) {
            this.isAlive = false;
            for (let closer of this.restnio.routes.get('wsClose').routes) {
                try { await this.executeRoute(closer, {reason}); }
                catch(err) { if (this.props.logErrors) console.error(err); }
            }
        }
    }

    close(reason) {
        this.callWSClose(reason);
        super.close();
        // Only on currectly open websocket, try to safely close.
        if ([this.ws.OPEN, this.ws.CONNECTING].includes(this.ws.readyState)) {
            if (reason) {
                if (Array.isArray(reason) && reason.length > 1) this.ws.close(reason[0], reason[1]);
                else this.ws.close(1000, reason);
            } else {
                this.ws.close();
            }
        }
        // After a while, force the closure.
        setTimeout(() => {
            if (this.ws.readyState !== this.ws.CLOSED) {
                this.ws.terminate();
            }
        }, this.restnio.options.websocket.hardClose);
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
            this.isActive = true;
        });
        let wsClient = this;
        function timeout() {
            if (!wsClient.isActive) {
                wsClient.close([408, 'Socket Timed-out']);
            } else {
                wsClient.isActive = false;
                wsClient.ws.ping(()=>{});
                setTimeout(timeout, wsClient.restnio.options.websocket.timeout);
            }
        }
        setTimeout(timeout, this.restnio.options.websocket.timeout);
    }

    /**
     * Sets up the action that happens when the websocket is externally closed.
     */
    setupClose() {
        this.ws.on('close', () => {
            this.callWSClose([1001, 'Client Closed Request']);
            // Only this, because the connection is already terminated at this stage.
            // We don't need to worry about closing on this side. WS takes care of that.
            super.close(); 
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