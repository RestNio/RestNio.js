/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

// Imports
const _ = require('lodash');
const Http = require('http');
const WebSocket = require('ws');

const HttpConnector = require('./connector/httpConnector');
const WsConnector = require('./connector/wsConnector');

const RouteMap = require('./util/RouteMap');
const HttpClient = require('./client/HttpClient');
const WebSocketClient = require('./client/WebSocketClient');
const InterClient = require('./client/InterClient');
const Router = require('./routes/Router');
const Route = require('./routes/Route');
/** @type {import("./authentication/Token")} */
const Token = require('./authentication/Token');
/** @type {import("./util/Options").Options} */
const Options = require('./util/Options');

/** @type {import("./params/").Params} */
const params = require('./params');
// Plugins
const serve = require('./plugins/serve');
const cors = require('./plugins/cors');
const ratelimit = require('./plugins/ratelimit');
const SubscriptionMap = require('./util/SubscriptionMap');
const ClientSet = require('./util/ClientSet');
const httpConnector = require('./connector/httpConnector');
const wsConnector = require('./connector/wsConnector');
const codecs = require('./codec');

/**
 * @exports RestNio
 * @class RestNio
 * @classdesc
 * Server driver for a REST and websocket interface.
 */
class RestNio {

    /**
     * Constructs a new RestNio server.
     * @param {import("./routes/Router").RouteBack} router - main router function.
     * @param {import("./util/Options").Options} options - options to use.
     */
    constructor(router, options) {
        // Expose restnio version for compatibility and plugins.
        this.version = require('../package.json').version;
        // Expose default paramtypes for easy access.
        this.params = this.$p = params;
        // Expose plugins for easy access
        this.serve = serve;
        this.cors = cors;
        this.ratelimit = ratelimit;
        // Expose connectors for easy access
        this.http = httpConnector;
        this.request = httpConnector.singleHttp;
        this.websocket = wsConnector;

        // Setup options
        /** @type {import("./util/Options").Options} */
        this.options = options = _.defaultsDeep(options || {}, Options);

        // Setup routemap. Must precede Router construction since Router defaults
        // its target to `rnio.routes`.
        /** @type {import("./util/RouteMap")} */
        this.routes = new RouteMap();
        this.router = new Router(this, options.path);

        // Setup subscription service.
        this.subscriptions = new SubscriptionMap();

        // Registry of named outbound peer connections.
        /** @type {Map<string, InterClient>} */
        this.inters = new Map();

        // Initialise the JWT authentication system.
        if (options.auth.enabled && options.auth.type === 'jwt') {
            /** @type {import("./authentication/Token")} */
            this.token = new Token(options.auth);
        }

        // Initialise & prepare the http server.
        this.httpServer = Http.createServer();
        if (options.http.enabled) {
            this.httpServer.on('request', (request, response) => new HttpClient(this, request, response));
        }
        // Initialise & prepare the websocket server.
        if (options.websocket.enabled) {
            this.wsServer = new WebSocket.Server({
                server: this.httpServer,
                // Subprotocol negotiation: accept the first requested protocol we
                // have a matching codec for. Clients that don't request any
                // subprotocol end up with `ws.protocol === ''`, which the
                // WebSocketClient resolves to the default JSON codec.
                handleProtocols: (protocols /*, request */) => {
                    for (const p of protocols) {
                        if (codecs.resolve(p)) return p;
                    }
                    return false;
                }
            });
            this.wsServer.on('connection', (ws, request) => new WebSocketClient(this, ws, request));
            if (options.websocket.addUpgradeRoute)
                this.router.ws('upgrade', () =>({message: 'token accepted'}));
        }

        // Initialise the main router.
        router(this.router, this);

        // Setup extra (default) routes after main routes are set.
        for (let path in options.default.routes) {
            this.routes.set(path, new Route(options.default.routes[path]));
        }

    }

    /**
     * Gets the clientset belonging to a certain subscription set name.
     * @param {string} name - The name of the subscription set to get.
     * @returns {ClientSet} - the clientset belonging to a subscription.
     */
    subs(name) {
        return this.subscriptions.get(name);
    }

    /**
     * Opens a persistent outbound websocket to another RestNio server and
     * registers it under `name`. The returned {@link InterClient} can be used
     * to send envelopes (`peer.obj({path, params})`) and to define routes
     * that fire when the remote pushes envelopes back. Routes are kept in a
     * peer-private map — they don't collide with the main `rnio.routes`.
     *
     * Example:
     * ```js
     * rnio.interconnect('park', 'ws://park.local/', {
     *   token: parkJwt,
     *   onConnect: () => console.log('linked to park'),
     *   routes: (router) => {
     *     router.ws('/setPower', { kw: rnio.params.number }, ({kw}) => turbine.set(kw));
     *   }
     * });
     * rnio.inter('park').obj({ path: '/turbine/heartbeat', params: { rpm: 12 } });
     * ```
     *
     * @param {string} name - logical name for `inter(name)` lookup.
     * @param {string} url - target websocket URL.
     * @param {import("./client/InterClient").InterconnectOptions} [options]
     * @returns {InterClient}
     */
    interconnect(name, url, options = {}) {
        if (this.inters.has(name)) {
            throw `Inter '${name}' is already registered.`;
        }
        const peer = new InterClient(this, name, url, options);
        this.inters.set(name, peer);
        return peer;
    }

    /**
     * Looks up a previously-registered outbound peer by name.
     * @param {string} name
     * @returns {InterClient}
     */
    inter(name) {
        const peer = this.inters.get(name);
        if (!peer) throw `No inter named '${name}' is registered.`;
        return peer;
    }

    /**
     * Starts the RestNio server and binds to the port.
     * @param {number} [port=this.options.port] - Optional port to bind to.
     * If not specified the port from the options will be taken.
     * The port in the options is defaulted to 7070
     */
    bind(port) {
        if (!port) port = this.options.port;
        this.httpServer.listen(port);
    }

}

// Expose default params staticly too.
RestNio.params = RestNio.$p = params;
// Expose connectors staticly too.
RestNio.http = httpConnector;
RestNio.request = httpConnector.singleHttp;
RestNio.websocket = wsConnector;
// Expose plugins staticly too.
RestNio.serve = serve;
RestNio.cors = cors;
RestNio.ratelimit = ratelimit;
// Expose codec registry for advanced use (inspect, register additional codecs).
RestNio.codecs = codecs;
module.exports = RestNio;