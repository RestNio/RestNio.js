/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

// Imports
/**
 * @typedef {import("../RestNio")} RestNio
 * @typedef {import("./Route")} Route
 * @typedef {import("./Route").RouteFunc} RouteFunc
 * @typedef {import("./Route").RouteDef} RouteDef
 * @typedef {import("./Route").ParamDef} ParamDef
 * @typedef {import("../util/RouteMap")} RouteMap
 */

// Consts
const Route = require('./Route');
const allHttpMethods = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'TRACE'];
const httpRegex = new RegExp([
    '^(?<protocol>https?:)\\/\\/',
    '(?<host>(?:www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,5})',
    '(?::(?<port>\\d{1,5}))?',
    '(?<path>\\/(?<spath>[-a-zA-Z0-9@:%._\\+~#=\\/]*))?',
    '(?<query>\\?(?<params>[-a-zA-Z0-9@:%._\\+~#=\\/\\&]*))?$'
].join(''), '');

/**
 * @class Router
 * @author 7kasper
 * @classdesc
 * Represents a router object. A router is an easy way to add
 * routes to the restnio's routing map.
 */
class Router {

    /**
     * Constructs a new restnio object.
     * @param {RestNio} rnio the restnio object to bind on.
     * @param {string} path the relative path to work on.
     * @param {RouteMap} [routeMap] - optional explicit RouteMap to write
     * registered routes into. Defaults to the main `rnio.routes` map. Used by
     * peer-scoped routers (e.g. {@link InterClient}) to keep their routes
     * isolated from the server's main route table.
     */
    constructor(rnio, path = '', routeMap = null) {
        this.rnio = rnio;
        this.path = path;
        /** @type {RouteMap} */
        this.routeMap = routeMap || rnio.routes;
    }

    //=====================================================\\
    //				          HTTP		          		   \\
    //=====================================================\\

    /**
     * Registers a route on http 'GET' method on specified path.
     * @param {string} path the path to register on.
     * @param {(RouteDef|RouteFunc)} routedef - either the main route function
     * that is to be executed or the full definition provided in style of a `RouteDef`.
     * @param {Object.<string, ParamDef>} [params] - if spreading out, an optional map
     * of parameter definitions.
     * @param {string[]} [permissions] - if spreading out, an optional set of permissions.
     * @param {boolean} [isActive] - if spreading out, an optional chance to define
     * the route to be inactive.
     */
    httpGet(path, routedef, params = {}, permissions = [], isActive = true) {
        this.httpDef('GET', path, routedef, params, permissions, isActive);
    }

    /**
     * Registers a route on http 'HEAD' method on specified path.
     * @param {string} path the path to register on.
     * @param {(RouteDef|RouteFunc)} routedef - either the main route function
     * that is to be executed or the full definition provided in style of a `RouteDef`.
     * @param {Object.<string, ParamDef>} [params] - if spreading out, an optional map
     * of parameter definitions.
     * @param {string[]} [permissions] - if spreading out, an optional set of permissions.
     * @param {boolean} [isActive] - if spreading out, an optional chance to define
     * the route to be inactive.
     */
    httpHead(path, routedef, params = {}, permissions = [], isActive = true) {
        this.httpDef('HEAD', path, routedef, params, permissions, isActive);
    }

    /**
     * Registers a route on http 'POST' method on specified path.
     * @param {string} path the path to register on.
     * @param {(RouteDef|RouteFunc)} routedef - either the main route function
     * that is to be executed or the full definition provided in style of a `RouteDef`.
     * @param {Object.<string, ParamDef>} [params] - if spreading out, an optional map
     * of parameter definitions.
     * @param {string[]} [permissions] - if spreading out, an optional set of permissions.
     * @param {boolean} [isActive] - if spreading out, an optional chance to define
     * the route to be inactive.
     */
    httpPost(path, routedef, params = {}, permissions = [], isActive = true) {
        this.httpDef('POST', path, routedef, params, permissions, isActive);
    }

    /**
     * Registers a route on http 'PUT' method on specified path.
     * @param {string} path the path to register on.
     * @param {(RouteDef|RouteFunc)} routedef - either the main route function
     * that is to be executed or the full definition provided in style of a `RouteDef`.
     * @param {Object.<string, ParamDef>} [params] - if spreading out, an optional map
     * of parameter definitions.
     * @param {string[]} [permissions] - if spreading out, an optional set of permissions.
     * @param {boolean} [isActive] - if spreading out, an optional chance to define
     * the route to be inactive.
     */
    httpPut(path, routedef, params = {}, permissions = [], isActive = true) {
        this.httpDef('PUT', path, routedef, params, permissions, isActive);
    }

    /**
     * Registers a route on http 'PATCH' method on specified path.
     * @param {string} path the path to register on.
     * @param {(RouteDef|RouteFunc)} routedef - either the main route function
     * that is to be executed or the full definition provided in style of a `RouteDef`.
     * @param {Object.<string, ParamDef>} [params] - if spreading out, an optional map
     * of parameter definitions.
     * @param {string[]} [permissions] - if spreading out, an optional set of permissions.
     * @param {boolean} [isActive] - if spreading out, an optional chance to define
     * the route to be inactive.
     */
    httpPatch(path, routedef, params = {}, permissions = [], isActive = true) {
        this.httpDef('PATCH', path, routedef, params, permissions, isActive);
    }

    /**
     * Registers a route on http 'DELETE' method on specified path.
     * @param {string} path the path to register on.
     * @param {(RouteDef|RouteFunc)} routedef - either the main route function
     * that is to be executed or the full definition provided in style of a `RouteDef`.
     * @param {Object.<string, ParamDef>} [params] - if spreading out, an optional map
     * of parameter definitions.
     * @param {string[]} [permissions] - if spreading out, an optional set of permissions.
     * @param {boolean} [isActive] - if spreading out, an optional chance to define
     * the route to be inactive.
     */
    httpDelete(path, routedef, params = {}, permissions = [], isActive = true) {
        this.httpDef('DELETE', path, routedef, params, permissions, isActive);
    }

    /**
     * Registers a route on http 'OPTIONS' method on specified path.
     * @param {string} path the path to register on.
     * @param {(RouteDef|RouteFunc)} routedef - either the main route function
     * that is to be executed or the full definition provided in style of a `RouteDef`.
     * @param {Object.<string, ParamDef>} [params] - if spreading out, an optional map
     * of parameter definitions.
     * @param {string[]} [permissions] - if spreading out, an optional set of permissions.
     * @param {boolean} [isActive] - if spreading out, an optional chance to define
     * the route to be inactive.
     */
    httpOptions(path, routedef, params = {}, permissions = [], isActive = true) {
        this.httpDef('OPTIONS', path, routedef, params, permissions, isActive);
    }

    /**
     * Registers a route on http 'TRACE' method on specified path.
     * @param {string} path the path to register on.
     * @param {(RouteDef|RouteFunc)} routedef - either the main route function
     * that is to be executed or the full definition provided in style of a `RouteDef`.
     * @param {Object.<string, ParamDef>} [params] - if spreading out, an optional map
     * of parameter definitions.
     * @param {string[]} [permissions] - if spreading out, an optional set of permissions.
     * @param {boolean} [isActive] - if spreading out, an optional chance to define
     * the route to be inactive.
     */
    httpTrace(path, routedef, params = {}, permissions = [], isActive = true) {
        this.httpDef('TRACE', path, routedef, params, permissions, isActive);
    }

    /**
     * Registers a specified route on all or all specified
     * http methods at specified path.
     * @param {string} path the path to register on.
     * @param {(RouteDef|RouteFunc)} routedef - either the main route function
     * that is to be executed or the full definition provided in style of a `RouteDef`.
     * @param {(Object.<string, ParamDef>|string[])} [params] - if spreading out, an optional map
     * of parameter definitions. If a routedef object is given this can be the http methods to register on.
     * @param {string[]} [permissions] - if spreading out, an optional set of permissions.
     * @param {boolean} [isActive] - if spreading out, an optional chance to define
     * the route to be inactive.
     * @param {string[]} [methods] - if spreading out, the http methods to register on. (Default: all)
     */
    httpAll(path, routedef, params = {}, permissions = [], isActive = true, methods = allHttpMethods) {
        if (this.rnio.options.http.enabled) {
            let route = new Route(routedef, params, permissions, isActive);
            // Support both object and 'old' style route defnition.
            if (typeof routedef === 'object' && params.length > 1) {
                methods = params;
            }
            this.defFull(`${this.httpPrefix(methods)}:${this.path}${path}`, route);
        }
    }

    /**
     * Creates a redirect route for http connections.
     * @param {string} path the relative path to redirect from. 
     * @param {string} location the relative or absolute path to redirect to.
     * @param {integer} [code] the http redirect code to use (Default: 302)
     * @param {boolean} [absolute] wether or not to use an absolute path (Default: false)
     * @param {string[]} [methods] which methods to redirect from. (Default: all)
     */
    httpRedirect(path, location, code = 302, absolute = false, methods = allHttpMethods) {
        location = absolute ? location : `${this.path}${location}`;
        this.defFull(
            `${this.httpPrefix(methods)}:${this.path}${path}`, 
            new Route((params, client) => client.redirect(location, code))
        );
    }

    /**
     * Get the http prefix for a certain path.
     * @param {string} methods the allowed http methods.
     * @returns the http prefix.
     */
    httpPrefix(methods) {
        let ret = 'HTTP:(?:';
        if (methods === allHttpMethods) {
            ret += '\\w+';
        } else {
            for (let method of methods) {
                ret += `(?:${method})|`;
            }
            ret = ret.slice(0,-1);
        }
        ret += ')';
        return ret;
    }

    /**
     * Defines / registers a full route specified.
     * This route functions only for http connections.
     * @param {string} method the http method to register on.
     * @param {string} path the relative path to register on.
     * @param {(RouteDef|RouteFunc)} routedef - either the main route function
     * that is to be executed or the full definition provided in style of a `RouteDef`.
     * @param {Object.<string, ParamDef>} [params] - if spreading out, an optional map
     * of parameter definitions.
     * @param {string[]} [permissions] - if spreading out, an optional set of permissions.
     * @param {boolean} [isActive] - if spreading out, an optional chance to define
     * the route to be inactive.
     */
    httpDef(method, path, routedef, params = {}, permissions = [], isActive = true) {
        if (this.rnio.options.http.enabled) {
            this.defFull(`${this.httpPrefix([method.toUpperCase()])}:${this.path}${path}`, 
                new Route(routedef, params, permissions, isActive));
        }
    }

    //=====================================================\\
    //				        WebSocket		       		   \\
    //=====================================================\\

    /**
     * Creates a redirect message for websocket connections.
     * @param {string} path the relative path to redirect from.
     * @param {string} location the relative or absolute path to redirect to.
     * @param {integer} [code] the redirect message to use (Default: 302)
     * @param {boolean} [absolute] wether or not to use an absolute path (Default: false)
     */
    wsRedirect(path, location, code = 302, absolute = false) {
        // TODO Make this a more standardized.. Implement in client class.
        location = absolute ? location : `${this.path}${location}`;
        this.defFull(`${this.wsPrefix()}:${this.path}${path}`, new Route(
            () => `Redirect (${code}) to: ${location}`)
        );
    }

    /**
     * Get the routeprefix for websocket connections.
     * @returns the websocket prefix.
     */
    wsPrefix() {
        return 'WS';
    }

    /**
     * Registers a specific route for websocket only.
     * @param {string} path the path to register at.
     * @param {(RouteDef|RouteFunc)} routedef - either the main route function
     * that is to be executed or the full definition provided in style of a `RouteDef`.
     * @param {Object.<string, ParamDef>} [params] - if spreading out, an optional map
     * of parameter definitions.
     * @param {string[]} [permissions] - if spreading out, an optional set of permissions.
     * @param {boolean} [isActive] - if spreading out, an optional chance to define
     * the route to be inactive.
     */
    ws(path, routedef, params = {}, permissions = [], isActive = true) {
        if (this.rnio.options.websocket.enabled) {
            this.defFull(`${this.wsPrefix()}:${this.path}${path}`,
                new Route(routedef, params, permissions, isActive));
        }
    }

    /**
     * Registers a binary websocket route.
     *
     * Named form — `router.wsBin('file', handler)` registers a route at
     * `wsBin-file`, dispatched when a client has opted into that route via
     * `client.setBinRoute('file')` and then sends a binary frame. The handler
     * receives `params = { data: Buffer, size: number }` and the client
     * instance, matching the standard `(params, client)` signature.
     *
     * Unnamed form — `router.wsBin(handler)` registers the *default* binary
     * route (`wsBin`), which is invoked when a binary frame arrives without
     * an active `binRoute` (and was not reclaimed as a MessagePack envelope).
     * If you don't register one, the built-in default throws a `400`.
     *
     * @param {(string|RouteDef|RouteFunc)} nameOrDef - route name, or the
     * route definition itself for the default (unnamed) binary handler.
     * @param {(RouteDef|RouteFunc)} [routedef] - route definition when a name
     * is given.
     * @param {Object.<string, ParamDef>} [params] - if spreading out, an optional map
     * of parameter definitions.
     * @param {string[]} [permissions] - if spreading out, an optional set of permissions.
     * @param {boolean} [isActive] - if spreading out, an optional chance to define
     * the route to be inactive.
     */
    wsBin(nameOrDef, routedef, params = {}, permissions = [], isActive = true) {
        if (!this.rnio.options.websocket.enabled) return;
        let name = null;
        if (typeof nameOrDef === 'string') {
            name = nameOrDef;
        } else {
            // Unnamed: shift args.
            routedef = nameOrDef;
        }
        const fullpath = name ? `wsBin-${name}` : 'wsBin';
        this.defFull(fullpath, new Route(routedef, params, permissions, isActive));
    }

    //=====================================================\\
    //				          Both		       	    	   \\
    //=====================================================\\

    /**
     * Registers a route on http 'GET' method and websocket
     * on specified path.
     * @param {string} path the path to register on.
     * @param {(RouteDef|RouteFunc)} routedef - either the main route function
     * that is to be executed or the full definition provided in style of a `RouteDef`.
     * @param {Object.<string, ParamDef>} [params] - if spreading out, an optional map
     * of parameter definitions.
     * @param {string[]} [permissions] - if spreading out, an optional set of permissions.
     * @param {boolean} [isActive] - if spreading out, an optional chance to define
     * the route to be inactive.
     */
    get(path, routedef, params = {}, permissions = [], isActive = true) {
        this.def('GET', path, routedef, params, permissions, isActive);
    }

    /**
     * Registers a route on http 'HEAD' method and websocket
     * on specified path.
     * @param {string} path the path to register on.
     * @param {(RouteDef|RouteFunc)} routedef - either the main route function
     * that is to be executed or the full definition provided in style of a `RouteDef`.
     * @param {Object.<string, ParamDef>} [params] - if spreading out, an optional map
     * of parameter definitions.
     * @param {string[]} [permissions] - if spreading out, an optional set of permissions.
     * @param {boolean} [isActive] - if spreading out, an optional chance to define
     * the route to be inactive.
     */
    head(path, routedef, params = {}, permissions = [], isActive = true) {
        this.def('HEAD', path, routedef, params, permissions, isActive);
    }

    /**
     * Registers a route on http 'POST' method and websocket
     * on specified path.
     * @param {string} path the path to register on.
     * @param {(RouteDef|RouteFunc)} routedef - either the main route function
     * that is to be executed or the full definition provided in style of a `RouteDef`.
     * @param {Object.<string, ParamDef>} [params] - if spreading out, an optional map
     * of parameter definitions.
     * @param {string[]} [permissions] - if spreading out, an optional set of permissions.
     * @param {boolean} [isActive] - if spreading out, an optional chance to define
     * the route to be inactive.
     */
    post(path, routedef, params = {}, permissions = [], isActive = true) {
        this.def('POST', path, routedef, params, permissions, isActive);
    }

    /**
     * Registers a route on http 'PUT' method and websocket
     * on specified path.
     * @param {string} path the path to register on.
     * @param {(RouteDef|RouteFunc)} routedef - either the main route function
     * that is to be executed or the full definition provided in style of a `RouteDef`.
     * @param {Object.<string, ParamDef>} [params] - if spreading out, an optional map
     * of parameter definitions.
     * @param {string[]} [permissions] - if spreading out, an optional set of permissions.
     * @param {boolean} [isActive] - if spreading out, an optional chance to define
     * the route to be inactive.
     */
    put(path, routedef, params = {}, permissions = [], isActive = true) {
        this.def('PUT', path, routedef, params, permissions, isActive);
    }

    /**
     * Registers a route on http 'PATCH' method and websocket
     * on specified path.
     * @param {string} path the path to register on.
     * @param {(RouteDef|RouteFunc)} routedef - either the main route function
     * that is to be executed or the full definition provided in style of a `RouteDef`.
     * @param {Object.<string, ParamDef>} [params] - if spreading out, an optional map
     * of parameter definitions.
     * @param {string[]} [permissions] - if spreading out, an optional set of permissions.
     * @param {boolean} [isActive] - if spreading out, an optional chance to define
     * the route to be inactive.
     */
    patch(path, routedef, params = {}, permissions = [], isActive = true) {
        this.def('PATCH', path, routedef, params, permissions, isActive);
    }

    /**
     * Registers a route on http 'DELETE' method and websocket
     * on specified path.
     * @param {string} path the path to register on.
     * @param {(RouteDef|RouteFunc)} routedef - either the main route function
     * that is to be executed or the full definition provided in style of a `RouteDef`.
     * @param {Object.<string, ParamDef>} [params] - if spreading out, an optional map
     * of parameter definitions.
     * @param {string[]} [permissions] - if spreading out, an optional set of permissions.
     * @param {boolean} [isActive] - if spreading out, an optional chance to define
     * the route to be inactive.
     */
    delete(path, routedef, params = {}, permissions = [], isActive = true) {
        this.def('DELETE', path, routedef, params, permissions, isActive);
    }

    /**
     * Registers a route on http 'OPTIONS' method and websocket
     * on specified path.
     * @param {string} path the path to register on.
     * @param {(RouteDef|RouteFunc)} routedef - either the main route function
     * that is to be executed or the full definition provided in style of a `RouteDef`.
     * @param {Object.<string, ParamDef>} [params] - if spreading out, an optional map
     * of parameter definitions.
     * @param {string[]} [permissions] - if spreading out, an optional set of permissions.
     * @param {boolean} [isActive] - if spreading out, an optional chance to define
     * the route to be inactive.
     */
    options(path, routedef, params = {}, permissions = [], isActive = true) {
        this.def('OPTIONS', path, routedef, params, permissions, isActive);
    }

    /**
     * Registers a route on http 'TRACE' method and websocket
     * on specified path.
     * @param {string} path the path to register on.
     * @param {(RouteDef|RouteFunc)} routedef - either the main route function
     * that is to be executed or the full definition provided in style of a `RouteDef`.
     * @param {Object.<string, ParamDef>} [params] - if spreading out, an optional map
     * of parameter definitions.
     * @param {string[]} [permissions] - if spreading out, an optional set of permissions.
     * @param {boolean} [isActive] - if spreading out, an optional chance to define
     * the route to be inactive.
     */
    trace(path, routedef, params = {}, permissions = [], isActive = true) {
        this.def('TRACE', path, routedef, params, permissions, isActive);
    }

    /**
     * Registers a specified route on all or all specified
     * http methods at specified path and websocket on that same specified path.
     * @param {string} path the path to register on.
     * @param {(RouteDef|RouteFunc)} routedef - either the main route function
     * that is to be executed or the full definition provided in style of a `RouteDef`.
     * @param {(Object.<string, ParamDef>|string[])} [params] - if spreading out, an optional map
     * of parameter definitions. If a routedef object is given this can be the http methods to register on.
     * @param {string[]} [permissions] - if spreading out, an optional set of permissions.
     * @param {boolean} [isActive] - if spreading out, an optional chance to define
     * the route to be inactive.
     * @param {string[]} [methods] - if spreading out, the http methods to register on. (Default: all)
     */
    all(path, routedef, params = {}, permissions = [], isActive = true, methods = allHttpMethods) {
        if (this.rnio.options.http.enabled || this.rnio.options.websocket.enabled) {
            let route = new Route(routedef, params, permissions, isActive);
            // Support both object and 'old' style route defnition.
            if (typeof routedef === 'object' && params.length > 1) {
                methods = params;
            }
            this.defFull(`${this.prefix(methods)}:${this.path}${path}`, route);
        }
    }

    /**
     * Creates a redirect route for http-clients and a message for websocket-clients.
     * @param {string} path the relative path to redirect from. 
     * @param {string} location the relative or absolute path to redirect to.
     * @param {integer} [code] the http redirect code to use (Default: 302)
     * @param {boolean} [absolute] wether or not to use an absolute path (Default: false)
     * @param {string[]} [methods] which http methods to redirect from. (Default: all)
     */
    redirect(path, location, code = 302, absolute = false, methods = allHttpMethods) {
        this.httpRedirect(path, location, code, absolute, methods);
        this.wsRedirect(path, location, code, absolute);
    }

    /**
     * Defines / registers a full route.
     * Arguments can be either a route object or an argument
     * array with function, params and permissions.
     * @param {string} method the http method to register on.
     * @param {string} path the relative path to register on.
     * @param {(RouteDef|RouteFunc)} routedef - either the main route function
     * that is to be executed or the full definition provided in style of a `RouteDef`.
     * @param {Object.<string, ParamDef>} [params] - if spreading out, an optional map
     * of parameter definitions.
     * @param {string[]} [permissions] - if spreading out, an optional set of permissions.
     * @param {boolean} [isActive] - if spreading out, an optional chance to define
     * the route to be inactive.
     */
    def(method, path, routedef, params = {}, permissions = [], isActive = true) {
        if (this.rnio.options.http.enabled || this.rnio.options.websocket.enabled) {
            this.defFull(`${this.prefix([method.toUpperCase()])}:${this.path}${path}`, 
                new Route(routedef, params, permissions, isActive));
        }
    }

    /**
     * Gets the prefix allowing both http and websocket connections.
     * If methods are profided only those will be allowed in the http prefix.
     * @param {string} [methods] the http methods to register on.
     * Defaults to all possible http methods.
     */
    prefix(methods = allHttpMethods) {
        let match = '(?:';
            if (this.rnio.options.http.enabled) match += this.httpPrefix(methods);
            if (this.rnio.options.http.enabled && this.rnio.options.websocket.enabled) match += '|';
            if (this.rnio.options.websocket.enabled) match += this.wsPrefix();
        match += ')';
        return match;
    }

    //=====================================================\\
    //				         Proxy		       	   	       \\
    //=====================================================\\

    /**
     * Registers a catch-all relay under `prefix` that transparently forwards
     * every request landing under it (HTTP + WS) to a target peer link. The
     * receiving server materialises the caller as a {@link ProxyClient} —
     * a real persistent in-process client that participates in the local
     * subscription map, accumulates state, and replies through the same
     * peer link back to the original caller. From the calling client's
     * point of view, the forwarded route returns its reply normally:
     * HTTP gets a response body, WS gets a return frame, subscriptions
     * deliver shadow-coalesced events.
     *
     * Mechanics:
     *  - Internally registers on `${prefix}/:rest*` so any descendant matches.
     *    `params.rest` carries the post-prefix path; the rest of the params
     *    pass through unchanged.
     *  - Resolves `opts.target` (function-or-direct) into a peer-link client
     *    (`InterClient` or peer-promoted `WebSocketClient`). When the
     *    target is missing/falsy, the route throws `[503, 'upstream offline']`.
     *  - Mints one {@link ProxyClient} session per `(caller, peer)` pair.
     *    HTTP callers are single-shot (`mode: 'request'`, fresh id every
     *    request, peer auto-closes the ProxyClient after the handler
     *    returns). WS callers reuse the same id across all requests on
     *    the same peer until disconnect; subs and state persist on the
     *    callee-side ProxyClient.
     *  - Replies (`_proxyr`) re-enter on the calling side and invoke the
     *    matching method on the original caller — `caller.obj(payload)`,
     *    `caller.err(msg, code)`, etc. HTTP callers' first reply writes
     *    the response body and closes; WS callers receive a frame and stay
     *    open.
     *  - Subscriptions made by the callee-side handler back-propagate
     *    automatically (`_proxyrsub`) so the original caller is locally
     *    subscribed on the calling side. Channel publishes on the callee
     *    side fan out as a single `_proxyrchan` shadow frame per peer
     *    regardless of subscriber count.
     *
     * Permission gate: pass `opts.permissions` to require perms ON the
     * calling client (not the upstream). Standard route perm checking
     * applies, including `:param` substitution. Typical:
     * `permissions: ['turbine.:turbineID']`. The caller's effective
     * permissions are also propagated as the actor on the proxy session
     * and re-clamped against the peer link's connection cap on the
     * callee side.
     *
     * Example:
     * ```js
     * router.proxy('/turbine/:turbineID', {
     *   target:      (p) => rnio.inter(`turbine-${p.turbineID}`),
     *   permissions: ['turbine.:turbineID'],
     * });
     * ```
     *
     * @param {string} prefix
     * @param {Object} opts
     * @param {(Client|function(Object, Client): Client)} opts.target
     *        Peer-link client to forward to, or a resolver function.
     * @param {string[]} [opts.permissions]
     * @param {string[]} [opts.methods] - HTTP methods to register for.
     *        Defaults to all. WS dispatch always registered.
     * @param {number} [opts.timeoutMs] - HTTP single-shot timeout (default
     *        30000). Persistent WS sessions ignore this.
     */
    proxy(prefix, opts = {}) {
        if (!opts || !opts.target) {
            throw 'router.proxy() requires opts.target (Client | function)';
        }
        const peerLink = require('../util/peerLink');

        const target = opts.target;
        const permissions = opts.permissions || [];
        const methods = opts.methods || allHttpMethods;
        const timeoutMs = (opts.timeoutMs == null) ? 30000 : opts.timeoutMs;
        const fullPath = `${prefix}/:rest*`;

        const handler = (params, client) => {
            const peer = (typeof target === 'function') ? target(params, client) : target;
            if (!peer || typeof peer.obj !== 'function' || !peer._isPeerLink) {
                // Thrown tuple becomes a proper status-coded error reply
                // (handled by Client.throwErr → err(msg, code)). Returning the
                // tuple would JSON-serialize it as a payload.
                throw [503, 'upstream offline'];
            }
            // Strip the captured tail before forwarding; the upstream sees
            // its own root-relative path, not the prefix this hop owned.
            const { rest, ...forward } = params;
            const path = '/' + (rest || '');

            // Build the actor claim. Preserve an existing actor (multi-hop)
            // or mint from the local connection.
            const actor = client.actor || {
                sub:   client.token && client.token.sub,
                perms: [...client.permissions],
            };

            let id;
            let openInfo = null;
            // Multi-hop pass-through: if our caller is itself an upstream
            // ProxyClient running in `request` mode (i.e. the original
            // entry-point was HTTP), every intermediate hop should also be
            // request-scoped. Otherwise an HTTP request would leave a chain
            // of persistent ProxyClients on every park between the source
            // and the actual handler.
            const callerSingleShot = client.type === 'http'
                || (client.type === 'proxy' && client.mode === 'request');

            if (callerSingleShot) {
                // One-shot. Fresh id every request, no caller memo. The
                // pending entry's TTL also bounds how long the HTTP response
                // stays open before a 504.
                id = peerLink.addPending(peer, client, { timeoutMs });
                openInfo = { actor, perms: actor.perms, mode: 'request' };
                if (client.type === 'http') {
                    // Stream-mode for the whole proxied response. Replies
                    // arrive as one or more `_proxyr` frames; only the
                    // final `kind: 'close', last: true` frame closes the
                    // response.
                    client._streaming = true;
                }
                // Track that this caller has an outstanding downstream
                // session. The intermediate-hop auto-close in
                // `proxyDispatch._handleEnv` (mode === 'request') reads
                // this counter to know whether replies are still expected.
                client._proxyOutstanding = (client._proxyOutstanding || 0) + 1;
            } else {
                // Persistent. Memoize id per (caller, peer).
                if (!client._proxyIds) client._proxyIds = new Map();
                id = client._proxyIds.get(peer);
                if (id == null) {
                    id = peerLink.addPending(peer, client, { timeoutMs: 0 });
                    client._proxyIds.set(peer, id);
                    openInfo = { actor, perms: actor.perms, mode: 'persistent' };
                }
            }

            const envFrame = { _proxyenv: { id, env: { path, params: forward } } };
            if (openInfo) envFrame._proxyenv.open = openInfo;
            peer.obj(envFrame);

            // HTTP: hold the response open. Replies arrive via `_proxyr` →
            //   `caller.obj(payload)` → HttpClient writes (no close while
            //   `_streaming`). The terminal `_proxyr.kind === 'close'`
            //   triggers `caller.close()` end-of-stream. The pending TTL
            //   handles the no-reply case.
            // WS: also Infinity. The reply lands as a frame on the caller's
            //   ws connection; subscribe events fan out via shadow channels.
            return Infinity;
        };

        this.all(fullPath, { func: handler, permissions }, {}, [], true, methods);
    }

    //=====================================================\\
    //				         Special		       	   	   \\
    //=====================================================\\

    /**
     * Imports & registers another router to a relative path.
     * You can enter empty or nothign string for path, to stack / merge
     * routers.
     * @param {string} [path=''] - the path to register the route on.
     * @param {RouteBack} router - The actual router function to use.
     * @param {boolean} [redirect=false] - whether or not to redirect index
     * of imported router to non trailing slash. If true
     * is specified /dogs will for instance redirect to /dogs/.
     */
    use(path, router, redirect = false) {
        // Support stacking router by specifing no path.
        if (typeof path === 'function') {
            redirect = router; router = path; path = '';
        }
        // If router is proper router function, execute and redirect if specified.
        if (typeof router === 'function') {
			router(new Router(this.rnio, this.path + path, this.routeMap), this.rnio);
			// Add actual redirect if necessary. Note that 307 is used for compatibility.
            if (redirect) this.redirect(path, path + '/', 307);
        } else {
            throw 'Could not initialise router!';
        }
    }

    /**
     * Registers a specified route on a specific full path.
     * Usually used to define special extra routes such as `wsConnect`, `wsClose` or `404`
     * WARNING: fullpath is not just the /example/test url,
     * it includes special formatting differentiating websocket
     * and multiple HTTP methods. Only use when you know what
     * you are doing.
     * @param {string} fullpath - The fullpath to register on.
     * @param {(RouteDef|RouteFunc)} routedef - either the main route function
     * that is to be executed or the full definition provided in style of a `RouteDef`.
     * @param {Object.<string, ParamDef>} [params] - if spreading out, an optional map
     * of parameter definitions.
     * @param {string[]} [permissions] - if spreading out, an optional set of permissions.
     * @param {boolean} [isActive] - if spreading out, an optional chance to define
     * the route to be inactive.
     */
    on(fullpath, routedef, params = {}, permissions = [], isActive = true) {
        this.defFull(fullpath, new Route(routedef, params, permissions, isActive));
    }

    /**
     * Defines a full route to the parent restnio instance.
     * @param {string} fullpath - the fullpath to register on.
     * @param {Route} route - the routing properties that happen on sepecief path.
     */
    defFull(fullpath, route) {
        this.routeMap.set(fullpath, route);
    }

}

/**
 * Describes the routeback.
 * In RestNio routers are mostly used inside these callback-style
 * functions that accept the router instance.
 * @callback RouteBack
 * @param {Router} router - the router instance.
 * @param {RestNio} rnio - reference to the spawning server instance.
 */

Router.allHttpMethods = allHttpMethods;
Router.httpRegex = httpRegex;
module.exports = Router;