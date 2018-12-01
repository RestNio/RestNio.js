/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

const Router = require('./Router');
const Http = require('http');
const WebSocket = require('ws');
const Url = require('url');

/**
 * @class RestNio
 * @classdesc
 * Server driver for a REST and websocket interface.
 * @constructor
 * @param {int} port the port for the server to bind on.
 * @param {security} security security settings to use.
 * @param {url} path the relative path to check requests at.
 */
class RestNio {

    constructor(port, security, router, path = '') {
        this.version = require('../package.json').version;
        this.port = port;
        this.security = security;
        this.path = path;
        this.routes = new Map();
        this.subscriptions = new Map();

        // Initialise the main router.
        router(new Router(this, path));

        // Initialise the http & websocket server.
        this.httpServer = Http.createServer();
        this.wsServer = new WebSocket.Server({server: this.httpServer});

        let routMap = this.routes;
        this.httpServer.on('request', (req, res) => {
            let url = Url.parse(req.url, true);
            let routename = 'HTTP|' + req.method + ':' + url.pathname;
            let route = this.routes.get(routename);
            if (route) {
                console.log(routename);
                route.func();
            }
            res.end('hi! :D');
        });
        this.wsServer.on('connection',  (ws) => {
            ws.on('message', (message) => {
              console.log('received: %s', message);
            });
            ws.send('something');
        });

    }

    bind() {
        this.httpServer.listen(this.port);
    }

}

exports = module.exports = RestNio;
exports.Router = Router;