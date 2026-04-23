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
const codecs = require('../codec');
/**
 * Typedef Imports
 * @typedef {import("../RestNio")} RestNio
 * @typedef {import("../util/Options").ClientProperties} ClientProperties
 * @typedef {import("../codec").Codec} Codec
 */

/**
 * @class WebSocketClient
 * @extends Client
 * @author 7kasper
 * @classdesc
 * Represents a websocket client.
 * A websocket client is backed by an open websocket connection.
 * Unlike the http connection, this client isn't restfull and can have
 * information stored on it (via {@link Client#state}) and be subscribed
 * to topics.
 *
 * Wire format is negotiated at handshake via `Sec-WebSocket-Protocol`:
 * - `restnio.json` (default) — envelopes travel as text frames.
 * - `restnio.msgpack` — envelopes travel as binary frames; disambiguated from
 *   raw binary data via a cheap first-byte sniff plus shape check.
 *
 * Binary frame routing:
 * - If {@link WebSocketClient#binRoute} is set (via `setBinRoute(name)`) all
 *   incoming binary frames go to the `wsBin-<name>` route with
 *   `params = { data: Buffer, size: number }`.
 * - Otherwise, for MessagePack clients the sniff may reclaim a frame as an
 *   envelope; anything that isn't an envelope falls through to the default
 *   `wsBin` route, which errors unless the application overrode it via
 *   `router.wsBin(handler)`.
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

        /**
         * The wire-format codec negotiated for this client at handshake.
         * @type {Codec}
         */
        this.codec = codecs.resolve(ws.protocol) || codecs.json;

        /**
         * Name of the currently-active binary route, or null when no explicit
         * route is bound. Incoming binary frames are dispatched to
         * `wsBin-<binRoute>` when set. Use {@link WebSocketClient#setBinRoute}
         * to mutate.
         * @type {string|null}
         */
        this.binRoute = null;

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

    /**
     * Sends a plain string as a text frame. Text frames are always treated by
     * the server as JSON envelopes on the receive side, regardless of codec.
     * @param {string} str
     */
    str(str) {
        super.str(str);
        this.ws.send(str);
    }

    /**
     * Sends raw bytes as a single binary frame. Call repeatedly to stream
     * (e.g. OTA firmware, file chunks).
     * @param {Buffer} buf
     */
    bin(buf) {
        super.bin(buf);
        this.ws.send(buf);
    }

    /**
     * Sends an object to the client, using the negotiated codec.
     *
     * - `Buffer` input is always sent as-is on a binary frame (no encoding).
     * - For JSON clients a plain string is sent as a text frame (unless
     *   `jsonResponse` is truthy, in which case it is JSON-stringified).
     * - Otherwise the codec is asked to encode; string results go on a text
     *   frame, `Buffer` results on a binary frame.
     * @param {*} obj
     */
    obj(obj) {
        if (Buffer.isBuffer(obj)) {
            this.bin(obj);
            return;
        }
        if (typeof obj === 'string' && !this.props.jsonResponse && this.codec.name === codecs.json.name) {
            this.str(obj);
            return;
        }
        const encoded = this.codec.encode(obj);
        if (typeof encoded === 'string') this.str(encoded);
        else this.bin(encoded);
    }

    err(err, code = 500) {
        try {
            super.err(err, code);
            const payload = { code: code, error: err.toString() };
            const encoded = this.codec.encode(payload);
            this.ws.send(encoded);
        } catch (err) {
            if (this.props.logErrors) console.error(err);
        }
    }

    /**
     * Sets the active binary route name. While set, every incoming binary
     * frame on this client is dispatched as raw bytes to the matching
     * `wsBin-<name>` route. Pass `null` (or call {@link WebSocketClient#clearBinRoute})
     * to return to the default behavior.
     * @param {string|null} name
     */
    setBinRoute(name) {
        this.binRoute = name || null;
    }

    /**
     * Clears the active binary route. Equivalent to `setBinRoute(null)`.
     */
    clearBinRoute() {
        this.binRoute = null;
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
                wsClient.close([1011, 'Socket Timed-out']);
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
     *
     * The `isBinary` second arg was added in ws 7+; we use it to split frames
     * into text (always JSON envelope) and binary (sniff + dispatch).
     */
    setupRouting() {
        this.ws.on('message', (message, isBinary) => {
            this.routeBeat(message, isBinary);
        });
    }

    /**
     * Dispatches an incoming websocket frame, branching on frame type.
     *
     * Text frame → JSON envelope (regardless of negotiated codec: text frames
     *   are unambiguous UTF-8 and therefore always JSON-parseable control
     *   messages).
     *
     * Binary frame → if a binRoute is set, raw dispatch; otherwise ask the
     *   codec to sniff & decode — if it looks like an envelope with a `.path`
     *   string, dispatch it; otherwise fall back to the default `wsBin` route.
     *
     * @param {Buffer|string} message - raw frame payload.
     * @param {boolean} isBinary - whether the frame was a binary frame.
     */
    async routeBeat(message, isBinary) {
        try {
            if (!isBinary) {
                let request = JSON.parse(message.toString());
                await this.routeEnvelope(request);
                return;
            }
            await this.handleBinaryFrame(Buffer.isBuffer(message) ? message : Buffer.from(message));
        } catch (err) {
            this.throwErr(err);
        }
    }

    /**
     * Routes a decoded envelope (from either a text frame or a sniffed binary
     * frame).
     * @param {*} request
     */
    async routeEnvelope(request) {
        if (typeof request !== 'object' || request === null) {
            request = { params: { body: request } };
        }
        if (!request.path) request.path = '/';
        await this.tokenCheck(request);
        const routename = 'WS:' + request.path;
        await this.run(routename, this.restnio.routes, Parser.parseFullWsParams, request);
    }

    /**
     * Handles a binary frame per the routing rules described on the class doc.
     * @param {Buffer} data
     */
    async handleBinaryFrame(data) {
        // 1) Explicit binary route wins — always dispatch raw.
        if (this.binRoute !== null) {
            await this.dispatchBinRoute(this.binRoute, data);
            return;
        }
        // 2) Codec may be able to reclaim the frame as an envelope.
        if (this.codec.sniff(data)) {
            try {
                const decoded = this.codec.decode(data);
                if (decoded && typeof decoded === 'object' && typeof decoded.path === 'string') {
                    await this.routeEnvelope(decoded);
                    return;
                }
            } catch (_) {
                // fall through to default binary handling
            }
        }
        // 3) Fall back to the default `wsBin` route.
        await this.dispatchBinRoute(null, data);
    }

    /**
     * Dispatches a raw binary payload to a named `wsBin-<name>` route or to
     * the default `wsBin` route when `name` is null.
     * @param {string|null} name
     * @param {Buffer} data
     */
    async dispatchBinRoute(name, data) {
        const routeName = name ? `wsBin-${name}` : 'wsBin';
        await this.run(routeName, this.restnio.routes,
            async () => ({ data, size: data.length }));
    }

}
module.exports = WebsocketClient;
