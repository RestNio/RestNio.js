/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

// Imports
const Http = require('http');
const WebSocket = require('ws');

const RouteMap = require('./util/RouteMap');
const HttpClient = require('./client/HttpClient');
const WebSocketClient = require('./client/WebSocketClient');
const Router = require('./routes/Router');
const Route = require('./routes/Route');
const Token = require('./authentication/Token');
const Options = require('./util/Options');

const params = require('./params');
const serve = require('./plugins/serve/Serve');

/**
 * @class RestNio
 * @classdesc
 * Server driver for a REST and websocket interface.
 */
class RestNio {

    /**
     * Constructs a new RestNio server.
     * @param {Function} router function router to accept the root router.
     * @param {any} options options to specify restnio with.
     */
    constructor(router, options) {
        this.version = require('../package.json').version; // Expose restnio version for plugins.
        this.params = params; // Expose default params for easy access.
        // Expose plugins for easy access
        this.serve = serve;

        // Setup options
        this.options = options = Options.optionate(options);
        this.router = new Router(this, options.path);

        // Setup routemap and default routes (such as 404 error).
        this.routes = new RouteMap();
        for (let path in options.default.routes) {
            this.routes.set(path, new Route([options.default.routes[path]]));
        }
        // Setup subscription service.
        this.subscriptions = new Map();

        // Initialise the authentication system.
        if (options.auth.enabled) {
            if (options.auth.type === 'jwt') this.token = new Token(options.auth);
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
            if (options.websocket.addUpgradeRoute) this.router.ws('/upgrade');
        }

        // Initialise the main router.
        router(this.router, this);
    }

    bind(port) {
        if (!port) port = this.options.port;
        this.httpServer.listen(port);
    }

}
// Expose default params staticly too.
RestNio.params = params;
module.exports = RestNio;