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
     */
    constructor(rnio, path = '') {
        this.rnio = rnio;
        this.path = path;
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
			router(new Router(this.rnio, this.path + path), this.rnio);
			// Add actual redirect if necessary. Note that 307 is used for compatibility.
            if (redirect) this.redirect(path, path + '/', 307);
        } else {
            throw 'Could not initialise router!';
        }
    }

    /**
     * Defines a full route to the parent restnio instance.
     * @param {string} fullpath - the fullpath to register on.
     * @param {Route} route - the routing properties that happen on sepecief path.
     */
    defFull(fullpath, route) {
        this.rnio.routes.set(fullpath, route);
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