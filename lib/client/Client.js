/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

// Imports
const PermissionSet = require('../util/PermissionSet');
const Clearer = require('../routing/Clearer');

/**
 * @class Client
 * @interface
 * @author 7kasper
 * @classdesc
 * Represents a client. 
 * A client is either a http endpoint or websocket connection.
 * Clients share common functions so the routings can be interchangable.
 * @constructor
 * @param {String} type the restnio object to bind on.
 */
class Client {

    constructor(type, permissions = [], info = {}) {
        this.type = type;
        this.permissions = new PermissionSet(permissions);
        this.info = new Map(Object.entries(info));
    }

    grantPermWithToken(token, restnio) {
        restnio.token.verify(token).then(token => {
            this.grantPerm(token.permissions);
        }).catch(err => {
            this.err(err);
        });
    }

    hasPerm(...perms) {
        return this.permissions.hasAll(...perms);
    }

    grantPerm(...perms) {
        this.permissions.grant(...perms);
    }

    revokePerm(...perms) {
        this.permissions.revoke(...perms);
    }

    ok() {
        console.log('-> OK');
    }

    obj(obj) {
        if (typeof obj === 'string') {
            this.str(obj);
        } else {
            this.str(JSON.stringify(obj));
        }
    }

    json(...args) {
        this.str(JSON.stringify(...args));
    }

    str(str) {
        console.log('-> ' + str);
    }

    err(err, code) {
        console.error('-> ' + code + ' - ' + err);
    }

    close() {
        console.log('Closed Client');
    }

    /**
     * Runs (finds and executes) a route or spits an error.
     * @param {string} routename the name of the route.
     * @param {Route[]} routes the list of routes to search in.
     * @param {Function} parser the parser to extract the params for the route.
     * @param  {...any} parseParams the unparsed params for the route.
     */
    run(routename, routes, parser, ...parseParams) {
        let route = routes.get(routename);
        if (route) {
            parser(...parseParams).then(params => {
                this.executeRoute(route, params);
            }).catch(err => {
                this.err('Parse Error: ' + err, 400);
            });
        } else {
            this.err('Route ' + routename + ' not found!', 404);
        }
    }

    /**
     * Checks permissions, checks and formats params
     * and if everything is ok, executes the route.
     * @param {any} route the route to execute
     * @param {any[]} params the params to use in the route.
     */
    executeRoute(route, params) {
        // Check permissions that are not param specific.
        Clearer.clearPermissions(
            route.permissions, 
            this.permissions, 
        ).then((paramPermissions) => {
            // Verify is params are ok according to route checks.
            Clearer.clearParams(route.params, params).then(params => {
                // Check permissions that are param specific.
                Clearer.clearParamPermissions(
                    paramPermissions, 
                    this.permissions, 
                    params
                ).then(() => {
                    // Execute function of the route and catch the result.
                    Promise.resolve(route.func(params, this)).then(routeReturn => {
                        // For http connections we just close with 200 (OK) 
                        // if the route returns nothing.
                        if (routeReturn === undefined) {
                            this.ok();
                        // With http Infinity keeps http connection open,
                        // then it is up to the route function to handle connection.
                        } else if (routeReturn !== Infinity) {
                            this.obj(routeReturn);
                        }
                    }).catch((err) => {
                        this.err(err);
                    });
                }).catch(err => {
                    this.err('Permission error: ' + err, 403);
                });
            }).catch(err => {
                this.err('Parameter Error: ' + err, 400);
            });
        }).catch(err => {
            this.err('Permission error: ' + err, 403);
        });
    }

}
module.exports = Client;