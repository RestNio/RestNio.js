/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

// Imports
const _ = require('lodash');
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

	/**
     * Give the client access to all permissions granted by a valid token.
     * @param {string} JWT token.
     * @param {RestNio} restnio.
     */
    grantPermWithToken(token, restnio) {
        restnio.token.verify(token).then(token => {
            this.grantPerm(token.permissions);
        }).catch(err => {
            this.err(err);
        });
    }

	/**
	 * Checks whether a client has access to a certain permission.
	 * @returns true, if the client has the permission to do what is specified.
	 */
    hasPerm(...perms) {
        return this.permissions.hasAll(...perms);
    }

	/**
	 * Give the client access to a certain permission.
	 * Permissions are upgraded following the rules specifed in `PermissionSet.grant()`
	 */
    grantPerm(...perms) {
        this.permissions.grant(...perms);
    }

	/**
	 * Rovoke the client access to a certain permission.
	 * Permissions are upgraded following the rules specifed in `PermissionSet.revoke()`
	 */
    revokePerm(...perms) {
        this.permissions.revoke(...perms);
    }

	/**
	 * Ok's a client. An ok is a typical response if a route was executed
	 * but doesn't really return something. Websockets stay open on ok,
	 * but the http implementation closes with a blank 200 status.
	 */
    ok() {
        console.log('-> OK'); //TODO: Better debug
    }

	/**
	 * Sends an object to the client.
	 * Strings will not be encoded, other objects
	 * will be send as JSON strings.
	 */
    obj(obj) {
        if (typeof obj === 'string') {
            this.str(obj);
        } else {
            this.str(JSON.stringify(obj));
        }
    }

	/**
	 * Send all arguments specified with JSON encoding.
	 */
    json(...args) {
        this.str(JSON.stringify(...args));
    }

	/**
	 * Sends a plain string to the client.
	 */
    str(str) {
        console.log('-> ' + str); //TODO: better debug.
    }

	/**
	 * Sends an error + statuscode to the client.
	 */
    err(err, code) {
        console.error('-> ' + code + ' - ' + err); //TODO: better debug.
    }

	/**
	 * Closes the connection with a client.
	*/
    close() {
        console.log('Closed Client'); //TODO: better debug.
    }

    /**
     * Runs (finds and executes) a route or spits an error.
     * @param {string} routepath the path of the route.
     * @param {Route[]} routeMap the map of routes to search in.
     * @param {Function} parser the parser to extract the params for the route.
     * @param  {...any} parseParams the unparsed params for the route.
     */
    async run(routepath, routeMap, parser, ...parseParams) {
        try {
            let params = await parser(...parseParams);
            let result = routeMap.get(routepath); // get matchin result and path params.
            params = _.defaultsDeep(params, result.pathParams); // merge all params (TODO Parse path params??)
            // Go and execute all routes, but stop once we served something (executed == true)
            for (let route of result.routes) {
                if (await this.executeRoute(route, params)) return;
            }
            this.ok(); // Optional close for http if nothing returned in all routes.
        } catch(err) {
            this.err('Parse Error: ' + err, 400);
        };
    }

    /**
     * Checks permissions, checks and formats params
     * and if everything is ok, executes the route.
     * @param {any} route the route to execute
     * @param {any[]} params the params to use in the route.
     * @returns true, if route returned something to client,
     * This return value is used to evaluate if the next route
     * should actually be executed.
     */
    async executeRoute(route, params) {
        try {
            // Check permissions that are not param specific.
            let paramPermissions = await Clearer.clearPermissions(
                route.permissions, 
                this.permissions, 
            );
            // Verify and transform params so they are ok according to route checks.
            params = await Clearer.clearParams(route.params, params);
            // Check permissions that are param specific.
            await Clearer.clearParamPermissions(
                paramPermissions, 
                this.permissions, 
                params
            );
            // Try to actually run the function of the route and catch the result.
            try {
                let routeReturn = await Promise.resolve(route.func(params, this));
                // For http connections we just close with 200 (OK) 
                // if the route returns nothing, move to next route.
                if (routeReturn === undefined) {
                    return false;
                // With http Infinity keeps http connection open,
                // then it is up to the route function to handle connection.
                } else if (routeReturn !== Infinity) {
                    this.obj(routeReturn);
                }
                return true; //Infinity or a return stops executing more routes.
            } catch(err) {
                this.err(err);
            }
        } catch (err) {
            this.err('Parameter / permission error: ' + err, 403);
        }
        // Upon error (that gets you here somehow), don't execute more routes.
        return true;
    }

}
module.exports = Client;
