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
        this.router = new Router(this, options.path);

        // Setup routemap.
        /** @type {import("./util/RouteMap")} */
        this.routes = new RouteMap();

        // Setup subscription service.
        this.subscriptions = new SubscriptionMap();

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
            this.wsServer = new WebSocket.Server({server: this.httpServer});
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
        if (this.options.websocket.motd) 
            this.options.websocket.motd = new Route(this.options.websocket.motd);

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
module.exports = RestNio;