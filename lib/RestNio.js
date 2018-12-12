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
const QueryString = require('query-string');

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

        // Handle http requests.
        this.httpServer.on('request', (request, response) => {
            // TODO: Move & format transforming logic.
            let url = Url.parse(request.url, true);
            new Promise((resolve) => {
                switch(request.method) {
                    case 'POST':
                    case 'PUT': {
                        let data = [];
                        request.on('data', (chunk) => {
                            data.push(chunk);
                        }).on('end', () => {
                            resolve(QueryString.parse(Buffer.concat(data).toString()));
                        });
                        break;
                    }
                    default: {
                        resolve(url.query);
                        break;
                    }
                }
            }).then((params) => {
                let routename = 'HTTP|' + request.method + ':' + url.pathname;
                let route = this.routes.get(routename);
                console.log(routename);
                console.log(params);
                if (route) {
                    let routeReturn = route.func(params);
                    if (routeReturn === undefined) {
                        response.end();
                    } else {
                        if (routeReturn !== Infinity) {
                            if (typeof routeReturn === 'string') {
                                response.end(routeReturn);
                            } else {
                                response.end(JSON.stringify(routeReturn));
                            }
                        }
                        // TODO make this clear:
                        // ELSE: RES STAYS OPEN! Route function should deal with it!
                    }
                } else {
                    response.statusCode = 404;
                    response.end('404');
                }
            })
        });

        // Handle websocket requests.
        this.wsServer.on('connection',  (ws) => {
            ws.on('message', (message) => {
                // TODO: Move & format transforming logic.
                console.log('Socket message: ' + message);
                let request = JSON.parse(message);
                // TODO: Better defaults implementation.
                if (!request.path) request.path = '/';
                let routename = 'WS:' + request.path;
                let route = this.routes.get(routename);
                let params = request.params ? request.params : [];
                console.log(routename);
                console.log(params);
                if (route) {
                    let routeReturn = route.func(params);
                    if (routeReturn !== undefined && routeReturn !== Infinity) {
                        if (typeof routeReturn === 'string') {
                            ws.send(routeReturn);
                        } else {
                            ws.send(JSON.stringify(routeReturn));
                        }
                    }
                } else {
                    ws.send('404');
                }
            });
            ws.send('Connected');
        });

    }

    bind() {
        this.httpServer.listen(this.port);
    }

}

exports = module.exports = RestNio;
exports.Router = Router;




// qs.parse(data, {
//     decoder(value) {
//         if (/^(\d+|\d*\.\d+)$/.test(value)) {
//             return parseFloat(value);
//         }

//         let keywords = {
//             true: true,
//             false: false,
//             null: null,
//             undefined: undefined,
//         };
//         if (value in keywords) {
//             return keywords[value];
//         }

//         return value;
//     }
// });