/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

// Imports
const _ = require('lodash');
const WebSocket = require('ws');
const Client = require('./Client');
const Route = require('../routes/Route');
const RouteMap = require('../util/RouteMap');
const Router = require('../routes/Router');
const Parser = require('../routing/Parser');
const codecs = require('../codec');
/**
 * Typedef Imports
 * @typedef {import("../RestNio")} RestNio
 * @typedef {import("../codec").Codec} Codec
 * @typedef {import("../util/Options").ClientProperties} ClientProperties
 * @typedef {import("../routes/Router").RouteBack} RouteBack
 */

/**
 * @typedef ReconnectOptions
 * @property {boolean} [enabled=true] - whether to auto-reconnect on close.
 * @property {number} [minDelay=500] - first retry delay (ms) and floor for jittered values.
 * @property {number} [maxDelay=30000] - cap on retry delay (ms).
 * @property {number} [factor=2] - multiplicative growth per attempt.
 * @property {number} [jitter=0.2] - +/- random jitter ratio applied to each computed delay.
 * @property {number} [maxAttempts=Infinity] - cap on the number of consecutive
 * failed connect attempts. When the cap is reached the peer fires `interFail`
 * (see "Lifecycle routes") and stops retrying. Use `peer.reopen()` to start
 * over after a failure. Default is unbounded.
 */

/**
 * Connection status.
 *  - `'connecting'` — initial state, or trying again after a close.
 *  - `'open'` — socket reached `OPEN` and is delivering frames.
 *  - `'closed'` — socket closed; reconnects may still be scheduled.
 *  - `'failed'` — `maxAttempts` exhausted; no further reconnects until
 *    `peer.reopen()`.
 *  - `'shut'` — `peer.close()` was called explicitly.
 * @typedef {('connecting'|'open'|'closed'|'failed'|'shut')} InterStatus
 */

/**
 * Inter-server connection callback.
 * @callback InterCallback
 * @param {InterClient} client - this peer.
 */

/**
 * @typedef InterconnectOptions
 * @property {string} [subprotocol] - codec subprotocol, e.g. 'restnio.json'
 * (default) or 'restnio.msgpack'. Negotiated with the remote at handshake.
 * @property {string} [token] - JWT sent as `Authorization: Bearer <token>`
 * header on the upgrade request. Use this to grant the peer permissions on
 * the remote server.
 * @property {string[]} [permissions] - permissions granted to this peer
 * *locally*, used by peer-scoped routes when running incoming envelopes.
 * @property {ReconnectOptions} [reconnect] - reconnect tuning. Disable with
 * `{ enabled: false }`.
 * @property {InterCallback} [onConnect] - fired on each successful (re)connect.
 * @property {(reason: any, client: InterClient) => void} [onClose] - fired on
 * close. `reason` is `[code, reasonString]`.
 * @property {(err: Error, client: InterClient) => void} [onError] - fired on
 * underlying ws errors.
 * @property {RouteBack} [routes] - router callback. By default this writes
 * directly into the main `rnio.routes` table — peer envelopes dispatch
 * through the same routes a normal websocket client would hit. Pass
 * `isolate: true` to redirect into a peer-private route map instead.
 * The {@link InterClient} is passed as the second arg. Use this callback
 * to register lifecycle handlers too: `router.on('interOpen', fn)` /
 * `interClose` / `interFail` mirror the existing `wsConnect` / `wsClose`
 * pattern.
 * @property {boolean} [isolate=false] - when `true`, the peer's incoming
 * envelopes dispatch through a peer-private route map and the `routes`
 * callback writes into that map instead of `rnio.routes`. Use this when
 * the *same* RestNio service is talking to itself (sibling-to-sibling)
 * and route names would collide, or when you want strong isolation
 * between routes a peer can call vs. routes local clients can call.
 * Default is shared — typical interconnect cases (turbine ↔ park) have
 * no schema overlap so route reuse is the desired behavior.
 * @property {ClientProperties} [properties] - per-peer client property
 * overrides (e.g. `debug: true`).
 */

/**
 * @class InterClient
 * @extends Client
 * @author 7kasper
 * @classdesc
 * Outbound peer connection, a `Client` whose websocket is opened by *us* and
 * pointed at *another* RestNio server. Symmetric to {@link WebSocketClient}:
 * envelopes flow both ways over the same socket. Outgoing frames are sent
 * with {@link Client#obj}/{@link Client#str}/{@link Client#bin}; incoming
 * frames are routed against this peer's own private {@link RouteMap}, never
 * against `rnio.routes`. That isolation lets a turbine define routes that
 * only the park can hit, without those routes leaking to the local ESPs.
 *
 * Construct via {@link RestNio#interconnect} rather than directly.
 *
 * Frames sent before the socket reaches `OPEN` are buffered and flushed on
 * connect; on a subsequent close the client auto-reconnects with exponential
 * backoff (configurable via `reconnect`), unless {@link InterClient#close} was
 * called explicitly.
 */
class InterClient extends Client {

    /**
     * @param {RestNio} restnio - reference to the local server.
     * @param {string} name - logical peer name; used by `rnio.inter(name)`.
     * @param {string} url - target websocket URL, e.g. `ws://park.local/`.
     * @param {InterconnectOptions} [options]
     */
    constructor(restnio, name, url, options = {}) {
        super('inter', restnio,
            // No real upstream HTTP request — synthesize a minimal one so the
            // base Client constructor (and any property defaults) can read
            // headers/socket fields without crashing.
            { headers: {}, socket: { remoteAddress: null } },
            _.defaultsDeep(options.properties || {}, restnio.options.default.wsProperties),
            options.permissions || []
        );

        this.name = name;
        this.url = url;

        this.subprotocol = options.subprotocol || codecs.json.name;
        /** @type {Codec} */
        this.codec = codecs.resolve(this.subprotocol) || codecs.json;
        if (options.token) this._authToken = options.token;

        this.reconnectOpts = _.defaultsDeep(options.reconnect || {}, {
            enabled: true,
            minDelay: 500,
            maxDelay: 30000,
            factor: 2,
            jitter: 0.2,
            maxAttempts: Infinity
        });
        this.onConnect = options.onConnect || (() => {});
        this.onClose = options.onClose || (() => {});
        this.onError = options.onError || (() => {});

        /**
         * Whether this peer keeps an isolated, peer-private route map. When
         * false (default), the peer shares `rnio.routes` with the main
         * server — registering a route via `peer.router` makes it reachable
         * to local clients and to peer pushes alike.
         * @type {boolean}
         */
        this.isolated = !!options.isolate;

        if (this.isolated) {
            // Peer-private route table. Seeded with the server's default
            // routes so 404 / wsBin fallbacks behave the same as on a normal
            // ws client.
            /** @type {RouteMap} */
            this.routes = new RouteMap();
            for (const path in restnio.options.default.routes) {
                this.routes.set(path, new Route(restnio.options.default.routes[path]));
            }
            /**
             * Peer-scoped router. Routes go into this peer's private
             * {@link RouteMap} — invisible to other clients.
             * @type {Router}
             */
            this.router = new Router(restnio, '', this.routes);
        } else {
            // Default: share the main route table. Routes registered via the
            // peer router are visible to ALL clients (HTTP, local WS, peer
            // pushes). Typical for heterogeneous interconnects (turbine ↔
            // park) where schemas don't collide.
            /** @type {RouteMap} */
            this.routes = restnio.routes;
            /** @type {Router} */
            this.router = restnio.router;
        }

        /**
         * Always-available reference to the main server router. Lets a peer
         * register routes onto `rnio.routes` even when running in isolated
         * mode — useful when only *some* of the peer's routes should also be
         * reachable by local clients.
         * @type {Router}
         */
        this.mainRouter = restnio.router;

        if (typeof options.routes === 'function') options.routes(this.router, this);

        /** @type {string|null} */
        this.binRoute = null;
        /** @type {WebSocket|null} */
        this.ws = null;
        this.isAlive = false;
        /**
         * Current connection status. Read it directly to gate work on the
         * peer being live: `if (peer.status === 'open') peer.obj(...)`.
         * @type {InterStatus}
         */
        this.status = 'connecting';
        this.shouldReconnect = this.reconnectOpts.enabled;
        this.reconnectAttempts = 0;
        /** @type {Error|null} */
        this._lastError = null;
        this._sendBuffer = [];
        this._reconnectTimer = null;

        this._connect();
    }

    /**
     * `true` when the underlying socket is in the OPEN state. Convenience
     * sugar for `peer.status === 'open'`.
     * @type {boolean}
     */
    get isOpen() { return this.status === 'open'; }

    //=====================================================\\
    //				        Connection	        	   	   \\
    //=====================================================\\

    /**
     * Opens (or re-opens) the underlying websocket and wires up event handlers.
     * Internal — call {@link RestNio#interconnect} once at startup; reconnects
     * are handled automatically.
     */
    _connect() {
        this.status = 'connecting';
        const headers = {};
        if (this._authToken) headers['authorization'] = `Bearer ${this._authToken}`;
        const ws = new WebSocket(this.url, [this.subprotocol], { headers });
        this.ws = ws;

        ws.on('open', () => {
            this.isAlive = true;
            this.status = 'open';
            const attempts = this.reconnectAttempts;
            this.reconnectAttempts = 0;
            this._lastError = null;
            // Flush anything that piled up while the socket was opening or
            // reconnecting. We deliberately drop nothing — the user expects
            // .obj() before connect to be delivered, not silently swallowed.
            const buffered = this._sendBuffer;
            this._sendBuffer = [];
            for (const payload of buffered) {
                try { ws.send(payload); }
                catch (err) { if (this.props.logErrors) console.error(err); }
            }
            try { this.onConnect(this); }
            catch (err) { if (this.props.logErrors) console.error(err); }
            this._fireLifecycle('interOpen', { url: this.url, attempts });
        });

        ws.on('message', (message, isBinary) => {
            this.routeBeat(message, isBinary);
        });

        ws.on('error', (err) => {
            this._lastError = err;
            try { this.onError(err, this); }
            catch (e) { if (this.props.logErrors) console.error(e); }
        });

        ws.on('close', (code, reason) => {
            this.isAlive = false;
            // Don't downgrade 'shut' (user-initiated close) — the close()
            // method has already set the terminal state and we want to
            // suppress the reconnect path entirely.
            if (this.status !== 'shut') this.status = 'closed';
            const reasonStr = reason && reason.length ? reason.toString() : null;
            try { this.onClose([code, reasonStr], this); }
            catch (err) { if (this.props.logErrors) console.error(err); }
            this._fireLifecycle('interClose', {
                code, reason: reasonStr, attempts: this.reconnectAttempts
            });
            if (this.shouldReconnect) this._scheduleReconnect();
        });
    }

    /**
     * Computes a jittered exponential-backoff delay and schedules the next
     * connect attempt. When `maxAttempts` has been exhausted, fires
     * `interFail` and stops retrying instead.
     */
    _scheduleReconnect() {
        const { minDelay, maxDelay, factor, jitter, maxAttempts } = this.reconnectOpts;
        if (this.reconnectAttempts >= maxAttempts) {
            this.shouldReconnect = false;
            this.status = 'failed';
            const lastErr = this._lastError;
            this._fireLifecycle('interFail', {
                attempts: this.reconnectAttempts,
                lastError: lastErr ? lastErr.toString() : null
            });
            return;
        }
        const base = Math.min(maxDelay, minDelay * Math.pow(factor, this.reconnectAttempts));
        const delta = base * jitter * (Math.random() * 2 - 1);
        const delay = Math.max(minDelay, Math.round(base + delta));
        this.reconnectAttempts++;
        this._reconnectTimer = setTimeout(() => {
            this._reconnectTimer = null;
            if (this.shouldReconnect) this._connect();
        }, delay);
    }

    /**
     * Dispatches a lifecycle event (`interOpen` / `interClose` / `interFail`)
     * through the peer's route map. Each registered handler is called with
     * `(params, peer)`. Errors in handlers are swallowed and logged so a
     * misbehaving handler can't break the connection state machine.
     * @param {string} name
     * @param {object} params
     */
    async _fireLifecycle(name, params) {
        const result = this.routes.get(name);
        if (!result || !result.routes || !result.routes.length) return;
        for (const route of result.routes) {
            try { await this.executeRoute(route, params); }
            catch (err) { if (this.props.logErrors) console.error(err); }
        }
    }

    /**
     * Restarts the connection — resets the retry counter, re-arms reconnects,
     * and opens a new socket if there isn't already one in flight. Use this
     * from an `interFail` or `interClose` handler to recover after the
     * automatic retry budget has been exhausted, or to force a reconnect.
     */
    reopen() {
        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
        }
        this.shouldReconnect = this.reconnectOpts.enabled;
        this.reconnectAttempts = 0;
        this._lastError = null;
        if (this.ws && [this.ws.OPEN, this.ws.CONNECTING].includes(this.ws.readyState)) {
            return;
        }
        this._connect();
    }

    //=====================================================\\
    //				       Communications	       	   	   \\
    //=====================================================\\

    /**
     * Low-level send. Frames sent before the socket reaches `OPEN` are
     * buffered and flushed in order on connect.
     * @param {string|Buffer} payload
     */
    _send(payload) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(payload);
        } else {
            this._sendBuffer.push(payload);
        }
    }

    /**
     * Sends a plain string as a text frame.
     * @param {string} str
     */
    str(str) {
        super.str(str);
        this._send(str);
    }

    /**
     * Sends raw bytes as a single binary frame.
     * @param {Buffer} buf
     */
    bin(buf) {
        super.bin(buf);
        this._send(buf);
    }

    /**
     * Sends an object to the remote, using the negotiated codec.
     *
     * - `Buffer` input is sent as-is on a binary frame (no encoding).
     * - For JSON peers a plain string is sent as a text frame (unless
     *   `jsonResponse` is truthy, in which case it is JSON-stringified).
     * - Otherwise the codec encodes; string results go on a text frame,
     *   `Buffer` results on a binary frame.
     *
     * Typical use: `peer.obj({ path: '/setPower', params: { kw: 1500 } })` to
     * trigger a route on the remote.
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
            this._send(encoded);
        } catch (e) {
            if (this.props.logErrors) console.error(e);
        }
    }

    //=====================================================\\
    //				          Routing	        	   	   \\
    //=====================================================\\

    /**
     * Sets the active binary route name. While set, every incoming binary
     * frame on this peer is dispatched as raw bytes to the matching
     * `wsBin-<name>` route in this peer's route map.
     * @param {string|null} name
     */
    setBinRoute(name) { this.binRoute = name || null; }

    /**
     * Clears the active binary route. Equivalent to `setBinRoute(null)`.
     */
    clearBinRoute() { this.binRoute = null; }

    /**
     * Branches an incoming frame between text (always JSON envelope) and
     * binary (codec sniff or named-route dispatch). Mirrors
     * {@link WebSocketClient#routeBeat}, but routes against this peer's own
     * route map.
     * @param {Buffer|string} message
     * @param {boolean} isBinary
     */
    async routeBeat(message, isBinary) {
        try {
            if (!isBinary) {
                const request = JSON.parse(message.toString());
                await this.routeEnvelope(request);
                return;
            }
            await this.handleBinaryFrame(Buffer.isBuffer(message) ? message : Buffer.from(message));
        } catch (err) {
            this.throwErr(err);
        }
    }

    /**
     * Dispatches a decoded envelope through this peer's route map.
     * Envelopes without a `path` fall through to '/'; non-object payloads are
     * wrapped as `{ params: { body } }`.
     * @param {*} request
     */
    async routeEnvelope(request) {
        if (typeof request !== 'object' || request === null) {
            request = { params: { body: request } };
        }
        if (!request.path) request.path = '/';
        const routename = 'WS:' + request.path;
        await this.run(routename, this.routes, Parser.parseFullWsParams, request);
    }

    /**
     * Handles an incoming binary frame per the same rules as
     * {@link WebSocketClient#handleBinaryFrame}.
     * @param {Buffer} data
     */
    async handleBinaryFrame(data) {
        if (this.binRoute !== null) {
            await this.dispatchBinRoute(this.binRoute, data);
            return;
        }
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
        await this.dispatchBinRoute(null, data);
    }

    /**
     * Dispatches raw bytes to a named `wsBin-<name>` peer route or the
     * default `wsBin` peer route.
     * @param {string|null} name
     * @param {Buffer} data
     */
    async dispatchBinRoute(name, data) {
        const routeName = name ? `wsBin-${name}` : 'wsBin';
        await this.run(routeName, this.routes,
            async () => ({ data, size: data.length }));
    }

    //=====================================================\\
    //				         Lifecycle	        	   	   \\
    //=====================================================\\

    /**
     * Closes the peer connection and disables further reconnects. Pass a
     * reason string or `[code, reason]` tuple to control the close frame.
     * @param {string|[number, string]} [reason]
     */
    close(reason) {
        this.shouldReconnect = false;
        this.status = 'shut';
        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
        }
        super.close();
        if (this.ws && [this.ws.OPEN, this.ws.CONNECTING].includes(this.ws.readyState)) {
            if (Array.isArray(reason) && reason.length > 1) this.ws.close(reason[0], reason[1]);
            else if (reason) this.ws.close(1000, String(reason));
            else this.ws.close();
        }
    }

}
module.exports = InterClient;
