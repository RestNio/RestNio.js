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
const serve = require('./plugins/serve');
const cors = require('./plugins/cors');

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

        // Setup options
        /** @type {import("./util/Options").Options} */
        this.options = options = _.defaultsDeep(options || {}, Options);
        this.router = new Router(this, options.path);

        // Setup routemap and default routes (such as 404 error).
        /** @type {import("./util/RouteMap")} */
        this.routes = new RouteMap();
        for (let path in options.default.routes) {
            this.routes.set(path, new Route(options.default.routes[path]));
        }

        // Setup subscription service.
        this.subscriptions = new Map();

        // Initialise the authentication system.
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
            this.wsServer.on('connection', ws => new WebSocketClient(this, ws));
            if (options.websocket.addUpgradeRoute) 
                this.router.ws('upgrade', () =>({message: 'token accepted'}));
        }

        // Initialise the main router.
        router(this.router, this);
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
RestNio.serve = serve;
RestNio.cors = cors;
module.exports = RestNio;