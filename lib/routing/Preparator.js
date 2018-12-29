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
const Clearer = require('./Clearer');
const Client = require('./Client');

/**
 * @class Parser
 * @author 7kasper
 * @classdesc
 * Holds all utility functions to setup
 * and prepare the HTTP and WebSocket server.
 * This also means the actual code that executes
 * the actual routes is inside this function, as this
 * is registered into the callback functions of the server.
 */
class Preparator {

    /**
     * Loads `req, res => route` onto the httpserver.
     * @param {HttpServer} httpServer 
     * @param {Route[]} routes 
     */
    static registerHttpServer(httpServer, routes) {
        httpServer.on('request', (request, response) => {
            // Setup http client.
            let url = Url.parse(request.url, true);
            let client = new Client.http(request, url, response);
            // Find route
            let routename = 'HTTP|' + request.method + ':' + url.pathname;
            let route = routes.get(routename);
            if (route) {
                // Extract parameters specified by client.
                Parser.parseFullHttpParams(request, url).then(params => {
                    Preparator.checkFormatExecute(client, route, params);
                }).catch(err => {
                    client.err('Parse Error: ' + err, 400);
                });
            } else {
                client.err('Route not found!', 404);
            }
        });
    }

    /**
     * Loads `req, res => route` onto the websocket server.
     * @param {WSServer} wsServer 
     * @param {any[]} routes 
     */
    static registerWsServer(wsServer, routes) {
        wsServer.on('connection',  (ws) => {
            // Setup websocket client.
            ws.isAlive = true;
            let client = new Client.ws(ws);
            // Setup Keep alive
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
            // Message of the day
            client.str('Connected!');

            ws.on('message', (message) => {
                // Find route & extract parameters.
                let request = JSON.parse(message);
                if (!request.path) request.path = '/';
                let routename = 'WS:' + request.path;
                let route = routes.get(routename);
                if (route) {
                    // Parse params from websocket.
                    Parser.parseFullWsParams(request).then((params) => {
                        Preparator.checkFormatExecute(client, route, params);
                    }).catch((err) => {
                        client.err('Parse Error: ' + err, 400);
                    });
                } else {
                    client.err('Route not found!', 404);
                }
            });

        });
    }

    /**
     * Checks permissions, checks and formats params
     * and if everything is ok, executes the route.
     * This is the **'main'** function of RestNio.
     * @param {Client} client 
     * @param {any} route 
     * @param {any[]} params 
     */
    static checkFormatExecute(client, route, params) {
        // Check permissions that are not param specific.
        Clearer.clearPermissions(
            route.permissions, 
            client.permissions, 
        ).then((paramPermissions) => {
            // Verify is params are ok according to route checks.
            Clearer.clearParams(route.params, params).then(params => {
                // Check permissions that are param specific.
                Clearer.clearParamPermissions(
                    paramPermissions, 
                    client.permissions, 
                    params
                ).then(() => {
                    // Execute function of the route and catch the result.
                    Promise.resolve(route.func(params, client)).then(routeReturn => {
                        // For http connections we just close with 200 (OK) 
                        // if the route returns nothing.
                        if (routeReturn === undefined) {
                            client.ok();
                        // With http Infinity keeps http connection open,
                        // then it is up to the route function to handle connection.
                        } else if (routeReturn !== Infinity) {
                            client.obj(routeReturn);
                        }
                    }).catch((err) => {
                        client.err(err);
                    });
                }).catch(err => {
                    client.err('Permission error: ' + err, 403);
                });
            }).catch(err => {
                client.err('Parameter Error: ' + err, 400);
            });
        }).catch(err => {
            client.err('Permission error: ' + err, 403);
        });
    }

}
module.exports = Preparator;