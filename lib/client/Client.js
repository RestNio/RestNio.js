/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

// Imports
const _ = require('lodash');
const { AsyncLocalStorage } = require('async_hooks');
const PermissionSet = require('../util/PermissionSet');
const SubBridge = require('../util/SubBridge');
const Clearer = require('../routing/Clearer');
const ProxyHelper = require('../util/ProxyHelper');

/**
 * Per-envelope dispatch context. Set on entry via `Client.runEnvelopeContext`;
 * read by the `actor` and `effectivePermissions` getters on Client.
 *
 * Keyed off async execution context, so concurrent envelope dispatches on the
 * same client object can't clobber each other across awaits.
 *
 * Shape: `{ actor: Object|null, permissions: PermissionSet|null }`.
 *
 * @type {AsyncLocalStorage<{actor: Object|null, permissions: PermissionSet|null}>}
 */
const envelopeContext = new AsyncLocalStorage();
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
        this.restnio = restnio; // Internal reference to the server object.
        this.request = request;
        this.props = _.defaultsDeep(props, restnio.options.default.properties);
        this.permissions = new PermissionSet(permissions);
        this.subscriptions = new Set(); // Set for storing the names of subscriptions.
        this.token = {};
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

        /**
         * Per-client app-level state bag. RestNio never reads or writes this;
         * it is reserved entirely for route handlers to stash request-scoped
         * (HTTP) or connection-scoped (WS) data without colliding with internal
         * client fields. Common uses: buffered binary uploads, auth context,
         * feature flags, per-connection counters.
         * @type {Object.<string, any>}
         */
        this.state = {};

    }

    /**
     * Per-envelope actor context. Non-null only while a relayed envelope
     * carrying `_actor` is being dispatched on this client (and only when the
     * client is a trusted peer link — see {@link InterClient}). Carries the
     * upstream caller's identity claim:
     *
     *   `{ sub?: string, perms?: string[], ...passthrough }`
     *
     * Route handlers that care about the original caller (auditing, logging,
     * downstream propagation) read it here; concurrency-safe across awaits
     * via `AsyncLocalStorage`.
     *
     * @returns {Object|null}
     */
    get actor() {
        const ctx = envelopeContext.getStore();
        return ctx ? ctx.actor : null;
    }

    /**
     * Permission set used for the *current* route's permission check. When an
     * envelope carries `_actor` on a trusted peer link, this is the clamp of
     * the link's connection perms with the caller's claimed perms (see
     * {@link PermissionSet#intersect}). Otherwise falls back to the client's
     * own connection permissions.
     *
     * Use this if you want to perform an extra perm check inside a route
     * handler with the *same* effective set the dispatcher used.
     *
     * @returns {PermissionSet}
     */
    get effectivePermissions() {
        const ctx = envelopeContext.getStore();
        return ctx && ctx.permissions ? ctx.permissions : this.permissions;
    }

    /**
     * Runs an async function inside a per-envelope context. The dispatcher
     * (e.g. {@link InterClient#routeEnvelope}) wraps `Client.run()` in this
     * so route handlers see the right `actor` / `effectivePermissions` even
     * across awaits, and concurrent envelopes don't clobber one another.
     *
     * Pass `{ actor: null, permissions: null }` to explicitly clear within a
     * sub-scope.
     *
     * @param {{actor: Object|null, permissions: PermissionSet|null}} ctx
     * @param {() => Promise<*>} fn
     * @returns {Promise<*>}
     */
    static runEnvelopeContext(ctx, fn) {
        return envelopeContext.run(ctx, fn);
    }

    /**
     * Attach a subscription-bridge to this peer-link client. Configures which
     * local sub channels flow OUT to the peer, and which inbound `sub.frame`
     * envelopes get re-published locally. See {@link SubBridge} for full
     * mechanics.
     *
     * Both sides of a peer link configure their own bridge — direction is
     * declared locally in `out` / `in`. Replaces an earlier bridge attached to
     * the same client (the previous one is torn down first).
     *
     * @param {import("../util/SubBridge").SubBridgeOptions} opts
     * @returns {SubBridge} the live bridge instance.
     */
    subBridge(opts) {
        if (this._subBridge) this._subBridge.teardown();
        this._subBridge = new SubBridge(this, opts);
        return this._subBridge;
    }

    /**
     * Internal — handles envelopes that carry a reserved `_type` field
     * (currently only `'sub.frame'` for sub-bridge payload propagation).
     * Returns true if the envelope was consumed by a typed handler, false if
     * it should fall through to normal path-based dispatch.
     *
     * Trust gate: typed envelopes are only honored when this client has a
     * configured {@link SubBridge}. A regular WS client without a bridge
     * cannot send arbitrary `_type` frames and have them route anywhere.
     *
     * @param {Object} request
     * @returns {boolean}
     */
    _dispatchTyped(request) {
        const t = request._type;
        if (typeof t !== 'string') return false;
        if (t === 'sub.frame') {
            if (this._subBridge) {
                this._subBridge.handleInFrame(request.channel, request.payload);
            }
            return true;
        }
        // Unknown type — drop silently. Reserved name space; future versions
        // may add types and we don't want noisy 404 fallbacks.
        return true;
    }

    /**
     * Async startup after init of client.
     * Call this inside client implementation before setting up other async stuff.
     */
    async startBeat() {
        // Extract client ip.
        try {
            this.ip = ProxyHelper.extractIp(this.restnio, this);
        } catch (err) { if (this.props.logErrors) console.error(err); } // Only log.
        if (!this.ip && this.restnio.options.proxy.rejectUnknown) {
            this.err(this.restnio.options.proxy.rejectMessage, 400);
            this.close();
        }
    }

    //=====================================================\\
    //				       Functionals  	       	   	   \\
    //=====================================================\\

	/**
     * Give the client access to all permissions granted by a valid token.
     * @param {string} JWT - the token to grant permissions with.
     */
    async grantPermWithToken(token) {
        token = await this.restnio.token.verify(token);
        this.token = token;
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

    /**
     * Subscribe to a list with the name name.
     * @param {string} name - The name of the list subscribing to.
     */
    subscribe(name) {
        this.subscriptions.add(name);
        this.restnio.subscriptions.subscribe(name, this);
    }

    /**
     * Unsubscribe to a list with the name name.
     * @param {string} name - The name of the list unsubscribing from.
     */
    unsubscribe(name) {
        this.subscriptions.delete(name);
        this.restnio.subscriptions.unsubscribe(name, this);
    }

    /**
     * Unsubscribe from all services.
     */
    unsubscribeAll() {
        this.subscriptions.forEach(name => this.unsubscribe(name));
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
        if (this.props.debug) console.log('-> OK');
    }

	/**
	 * Sends an object to the client.
	 * Strings will not be encoded, 
     * buffers will be send with .buf()
     * other objects will be send as JSON strings.
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
        if (this.props.debug) console.log('-> ' + str);
    }

    /**
     * Sends a buffer to the client. (Raw Bytes)
     *
     * Preferred alias: {@link Client#bin}. `buf` is retained for back-compat
     * and simply forwards to `bin` on concrete implementations.
     * @param {Buffer} buf
     */
    buf(buf) {
        this.bin(buf);
    }

    /**
     * Sends raw binary data to the client.
     *
     * - **HTTP:** writes the buffer to the response body. If no `content-type`
     *   was set, defaults to `application/octet-stream`. For streaming,
     *   multiple calls before `end()` are sent as chunked-encoding writes.
     * - **WebSocket:** sends a single binary frame. Can be called repeatedly
     *   to stream multiple frames (for example when serving OTA firmware).
     * @param {Buffer} buf - the raw bytes to send.
     */
    bin(buf) {
        if (this.props.debug) console.log('-> ' + buf);
    }

	/**
	 * Sends an error + statuscode to the client.
	 */
    err(err, code) {
        if (this.props.logErrors) console.error('-> ' + code + ' - ' + err);
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
        this.unsubscribeAll(); // Unsubscribe from all subscriptions.
        if (this.props.debug) console.log('Closed Client');
    }

    /**
     * Get or set a header property.
     * NOTE: CURRENTLY ONLY HTTP SUPPORT
     * @param {string} header - the header name to get / set.
     * @param {string} [value] - if specified the value to set in the header.
     */
    header(header, value) {
        if (value !== undefined) {
            if (this.props.debug) console.log(`[${header}] -> ${value}`);
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
            if (this.props.debug) console.log(`![${name}]! -> ${value}${JSON.stringify(options)}`);
        }
    }

    /**
     * Clears a cookie.
     * NOTE: CURRENTLY ONLY HTTP SUPPORT
     * @param {string} name - the name of the cookie to clear. 
     */
    clearCookie(name) {
        this.cookie(name, '', {expires: new Date(0)});
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
            if (this.props.debug) { process.stdout.write('<-'); console.log(params); }
            // Effective perm set for this envelope. When an upstream peer
            // attached `_actor`, this is the clamp of the link cap and the
            // caller's claimed perms. Otherwise it's just `this.permissions`.
            const effective = this.effectivePermissions;
            // Check permissions that are not param specific.
            let paramPermissions = await Clearer.clearPermissions(
                route.permissions,
                effective,
            );
            // Verify and transform params so they are ok according to route checks.
            params = await Clearer.clearParams(route.params, params);
            // Check permissions that are param specific.
            await Clearer.clearParamPermissions(
                paramPermissions, effective, params
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
