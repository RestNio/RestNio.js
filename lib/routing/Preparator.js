/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

// Imports
const Url = require('url');
const Parser = require('./Parser');
const Verifier = require('./Verifier');
const Client = require('./Client');

class Preparator {

    static registerHttpServer(httpServer, routes) {
        // Handle http requests.
        httpServer.on('request', (request, response) => {
            let url = Url.parse(request.url, true);
            let client = new Client.http(request, url, response);
            let routename = 'HTTP|' + request.method + ':' + url.pathname;
            let route = routes.get(routename);
            if (route) {
                Parser.parseFullHttpParams(request, url).then(params => {
                    Verifier.verifyParams(route.params, params)
                    .then((params) => {
                        Promise.resolve(route.func(params, client)).then(routeReturn => {
                            if (routeReturn === undefined) {
                                response.end();
                            } else {
                                //Infinity keeps http connection open.
                                if (routeReturn !== Infinity) {
                                    client.pushVar(routeReturn);
                                }
                            }
                        }).catch((err) => {
                            client.sendFullError(err);
                        });
                    }).catch((err) => {
                        client.sendFullError('Parameter Error: ' + err, 400);
                    })
                }).catch((err) => {
                    client.sendFullError('Parse Error: ' + err, 400);
                });
            } else {
                client.sendFullError('Route not found!', 404);
            }
        });
    }

    static registerWsServer(wsServer, routes) {
        // Handle websocket requests.
        wsServer.on('connection',  (ws) => {
            // Setup websocket client.
            ws.isAlive = true;
            let client = new Client.ws(ws);
            ws.send('Connected!');

            ws.on('message', (message) => {
                let request = JSON.parse(message);
                if (!request.path) request.path = '/';
                let routename = 'WS:' + request.path;
                let route = routes.get(routename);
                if (route) {
                    Parser.parseFullWsParams(request).then((params) => {
                        Verifier.verifyParams(route.params, params)
                        .then((params) => {
                            Promise.resolve(route.func(params, client)).then(routeReturn => {
                                if (routeReturn !== undefined && routeReturn !== Infinity) {
                                    client.pushVar(routeReturn);
                                }
                            }).catch((err) => {
                                client.sendFullError(err);
                            });
                        }).catch((err) => {
                            client.sendFullError('Parameter Error: ' + err, 400);
                        });
                    }).catch((err) => {
                        client.sendFullError('Parse Error: ' + err, 400);
                    });
                } else {
                    client.sendFullError('Route not found!', 404);
                }
            });
            // Keep alive
            ws.on('pong', () => {
                ws.isAlive = true;
            });
            setInterval(() => {
                if (!ws.isAlive) {
                    client.close();
                } else {
                    ws.isAlive = false;
                    ws.ping();
                }
            }, 30000);
        });
    }

}
module.exports = Preparator;