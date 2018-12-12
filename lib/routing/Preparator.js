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

class Preparator {

    static registerHttpServer(httpServer, routes) {
        // Handle http requests.
        httpServer.on('request', (request, response) => {
            let url = Url.parse(request.url, true);
            let routename = 'HTTP|' + request.method + ':' + url.pathname;
            let route = routes.get(routename);
            if (route) {
                Parser.parseFullHttpParams(request, url, (params) => {
                    Verifier.verifyParams(route.params, params)
                    .then((params) => {
                        let routeReturn = route.func(params);
                        if (routeReturn === undefined) {
                            response.end();
                        } else {
                            //Infinity keeps connection open.
                            if (routeReturn !== Infinity) {
                                if (typeof routeReturn === 'string') {
                                    response.end(routeReturn);
                                } else {
                                    response.end(JSON.stringify(routeReturn));
                                }
                            }
                        }
                    }).catch((err) => {
                        response.end('' + err);
                    })
                });
            } else {
                response.statusCode = 404;
                response.end('404');
            }
        });
    }

    static registerWsServer(wsServer, routes) {
        // Handle websocket requests.
        wsServer.on('connection',  (ws) => {
            ws.on('message', (message) => {
                let request = JSON.parse(message);
                if (!request.path) request.path = '/';
                let routename = 'WS:' + request.path;
                let route = routes.get(routename);
                if (route) {
                    Parser.parseFullWsParams(request, (params) => {
                        Verifier.verifyParams(route.params, params)
                        .then((params) => {
                            let routeReturn = route.func(params);
                            if (routeReturn !== undefined && routeReturn !== Infinity) {
                                if (typeof routeReturn === 'string') {
                                    ws.send(routeReturn);
                                } else {
                                    ws.send(JSON.stringify(routeReturn));
                                }
                            }
                        }).catch((err) => {
                            ws.send(err);
                        });
                    });
                } else {
                    ws.send('404');
                }
            });
            ws.send('Connected');
        });
    }

}
module.exports = Preparator;