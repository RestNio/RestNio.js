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
const ProxyHelper = require('../util/ProxyHelper');
/**
 * Typedef Imports
 * @typedef {import("../RestNio")} RestNio
 * @typedef {import("../util/RouteMap")} RouteMap
 * @typedef {import("../routes/Route")} Route
 * @typedef {import("../util/Options").ClientProperties} ClientProperties
 * @typedef {import("../util/Options").CookieOptions} CookieOptions
 */

/**
 * @exports Client
 * @class Client
 * @interface
 * @author 7kasper
 * @classdesc
 * Represents a client. 
 * A client is either a http endpoint or websocket connection.
 * Clients share common functions so the routings can be interchangable.
 */
class Client {

    /**
     * @param {String} type - the client type.
     * @param {RestNio} restnio - reference to the server.
     * @param {Request} request - reference to the (instantiating) HTTP request.
     * @param {ClientProperties} [props] - optional properties about the client.
     * @param {String[]} [permissions] - optional set of permission the clients starts with.
     */
    constructor(type, restnio, request, props = {}, permissions = []) {
        this.type = type;
        this.request = request;
        this.props = _.defaultsDeep(props, restnio.options.default.properties);
        this.permissions = new PermissionSet(permissions);
        /** @type {(string | null)}*/ this.ip = null; // Filled in at startbeat.

        /**
         * Get all headers from the client.
         * NOTE: CURRENTLY ONLY HTTP SUPPORT
         * @type {Object.<string, string>}
         */
        this.headers = {};

        /**
         * Get all cookies belonging to the client.
         * NOTE: CURRENTLY ONLY HTTP SUPPORT
         * @type {Object.<string, string>}
         */
        this.cookies = {};

    }

    /**
     * Async startup after init of client.
     * Call this inside client implementation before setting up other async stuff.
     * @param {RestNio} restnio 
     */
    async startBeat(restnio) {
        // Extract client ip.
        try {
            this.ip = ProxyHelper.extractIp(restnio, this);
        } catch (err) { console.error(err); } // Only log.
        if (!this.ip && restnio.options.proxy.rejectUnknown) {
            this.err(restnio.options.proxy.rejectMessage, 400);
            this.close();
        }
    }

    //=====================================================\\
    //				       Functionals  	       	   	   \\
    //=====================================================\\

	/**
     * Give the client access to all permissions granted by a valid token.
     * @param {string} JWT - the token to grant permissions with.
     * @param {RestNio} restnio - instance of the server for options etc.
     */
    async grantPermWithToken(token, restnio) {
        token = await restnio.token.verify(token);
        this.grantPerm(token.permissions);
    }

	/**
	 * Checks whether a client has access to a certain permission.
     * @param {...string} perms - the permissions to check.
	 * @returns true, if the client has the permission to do what is specified.
	 */
    hasPerm(...perms) {
        return this.permissions.hasAll(...perms);
    }

	/**
	 * Give the client access to a certain permission.
	 * Permissions are upgraded following the rules specifed in `PermissionSet.grant()`
     * @param {...string} perms - the permissions to grant.
	 */
    grantPerm(...perms) {
        this.permissions.grant(...perms);
    }

	/**
	 * Rovoke the client access to a certain permission.
	 * Permissions are upgraded following the rules specifed in `PermissionSet.revoke()`
     * @param {...string} perms - the permissions to revoke.
	 */
    revokePerm(...perms) {
        this.permissions.revoke(...perms);
    }

    //=====================================================\\
    //				       Communications	       	   	   \\
    //=====================================================\\

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
        if (typeof obj === 'string' && !this.props.jsonResponse) {
            this.str(obj);
        } else if (Buffer.isBuffer(obj)) {
            // this.header('Transfer-Encoding', 'chunked');
            this.buf(obj);
        } else {
            // TODO: Other types of obj encoding?
            this.header('content-type', 'application/json');
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
     * Sends a buffer to the client. (Raw Bytes)
     * @param {Buffer} buf 
     */
    buf(buf) {
        console.log('-> ' + buf); //TODO: better debug.
    }

	/**
	 * Sends an error + statuscode to the client.
	 */
    err(err, code) {
        console.error('-> ' + code + ' - ' + err); //TODO: better debug.
    }

    /**
     * throws an client error in the neat way.
     */
    throwErr(err) {
        if (Array.isArray(err) && err.length > 1) this.err(err[1], err[0]);
        else this.err(err);
    }

	/**
	 * Closes the connection with a client.
	*/
    close() {
        console.log('Closed Client'); //TODO: better debug.
    }

    /**
     * Get or set a header property.
     * NOTE: CURRENTLY ONLY HTTP SUPPORT
     * @param {string} header - the header name to get / set.
     * @param {string} [value] - if specified the value to set in the header.
     */
    header(header, value) {
        if (value !== undefined) {
            console.log(`[${header}] -> ${value}`); //TODO: BETTER DEBUG.
        }
    }

    /**
     * Get or set a cookie :)
     * NOTE: CURRENTLY ONLY HTTP SUPPORT
     * @param {string} name - the name of the cookie to get / set.
     * @param {any} [value] - if specified, the value to set the cookie to.
     * @param {CookieOptions} [options] - if specified the cookie options.
     */
    cookie(name, value, options) {
        if (value !== undefined) {
            console.log(`![${name}]! -> ${value}${JSON.stringify(options)}`); //TODO: BETTER DEBUG.
        }
    }

    //=====================================================\\
    //				         Routing	           	   	   \\
    //=====================================================\\

    /**
     * Runs (finds and executes) a route or spits an error.
     * @param {string} routepath the path of the route.
     * @param {RouteMap} routeMap the map of routes to search in.
     * @param {Function} parser the parser to extract the params for the route.
     * @param  {...any} parseParams the unparsed params for the route.
     */
    async run(routepath, routeMap, parser, ...parseParams) {
        try {
            let result = routeMap.get(routepath); // get matching result and path params.
            let params = result.pathParams;
            params = _.defaultsDeep(params, await parser(...parseParams)); // merge all params (TODO Parse path params??)
            this.lastroute = routepath; // Set last executed route path for use in functions.
            let activeRoutes = 0; // Count the number of active routes for possible 404 error.
            // Go and execute all routes, but stop once we served something (executed == true)
            for (let route of result.routes) {
                if (route.isActive) activeRoutes++;
                if (await this.executeRoute(route, params)) return;
            }
            // If no active routes are executed (active is either specified (defualt is true) 
            // or when a route returns something) then we want to show the default 404 error.
            if (activeRoutes === 0) {
                for (let route404 of routeMap.get('404').routes) {
                    await this.executeRoute(route404, []);
                }
            }
            // If this code is reached, we have an active route but it most likely did not talk
            // to the client. We return the optional ok (HTTP 200) to prevent loose http connections.
            else {
                this.ok();
            }
        } catch(err) {
            this.err('Parse Error: ' + err, 400);
        };
    }

    /**
     * Checks permissions, checks and formats params
     * and if everything is ok, executes the route.
     * @param {Route} route the route to execute
     * @param {Object} params the params to use in the route.
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
                paramPermissions, this.permissions, params
            );
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
        } catch (err) {
            this.throwErr(err);
        }
        // Upon error (that gets you here somehow), don't execute more routes.
        return true;
    }

}
module.exports = Client;
