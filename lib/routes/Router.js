/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

// Consts
const Route = require('./Route');
const allHttpMethods = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'TRACE'];

/**
 * @class Router
 * @author 7kasper
 * @classdesc
 * Represents a router. A router is an easy way to add
 * routes to the restnio's routing map.
 * @constructor
 * Constructs a new restnio object.
 * @param {RestNio} rnio the restnio object to bind on.
 * @param {string} path the relative path to work on.
 */
class Router {

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
     * @param  {...any} route the route definition. (See `Route`)
     */
    httpGet(path, ...route) {
        this.httpDef('GET', path, ...route);
    }

    /**
     * Registers a route on http 'HEAD' method on specified path.
     * @param {string} path the path to register on.
     * @param  {...any} route the route definition. (See `Route`)
     */
    httpHead(path, ...route) {
        this.httpDef('HEAD', path, ...route);
    }

    /**
     * Registers a route on http 'POST' method on specified path.
     * @param {string} path the path to register on.
     * @param  {...any} route the route definition. (See `Route`)
     */
    httpPost(path, ...route) {
        this.httpDef('POST', path, ...route);
    }

    /**
     * Registers a route on http 'PUT' method on specified path.
     * @param {string} path the path to register on.
     * @param  {...any} route the route definition. (See `Route`)
     */
    httpPut(path, ...route) {
        this.httpDef('PUT', path, ...route);
    }

    /**
     * Registers a route on http 'PATCH' method on specified path.
     * @param {string} path the path to register on.
     * @param  {...any} route the route definition. (See `Route`)
     */
    httpPatch(path, ...route) {
        this.httpDef('PATCH', path, ...route);
    }

    /**
     * Registers a route on http 'DELETE' method on specified path.
     * @param {string} path the path to register on.
     * @param  {...any} route the route definition. (See `Route`)
     */
    httpDelete(path, ...route) {
        this.httpDef('DELETE', path, ...route);
    }

    /**
     * Registers a route on http 'OPTIONS' method on specified path.
     * @param {string} path the path to register on.
     * @param  {...any} route the route definition. (See `Route`)
     */
    httpOptions(path, ...route) {
        this.httpDef('OPTIONS', path, ...route);
    }

    /**
     * Registers a route on http 'TRACE' method on specified path.
     * @param {string} path the path to register on.
     * @param  {...any} route the route definition. (See `Route`)
     */
    httpTrace(path, ...route) {
        this.httpDef('TRACE', path, ...route);
    }

    /**
     * Registers a specified route on all or all specified
     * http methods at specified path.
     * @param {string} path the path to register on.
     * @param {...any} params split array of params:  
     *   Either:  
     *   {Function} route - the route function.  
     *   {any} [paramdefs] - the definitions of the params. (Default: empty)  
     *   {string[]} [permssions] - list of required permissions. (Default: empty)  
     *   {string[]} [methods] - list of http methods to register on (Defualt: all)  
     *   Or:  
     *   {any} Route - an object specifying the route definition.  
     *   {string[]} [methods] - list of http methods to register on (Defualt: all)
     */
    httpAll(path, ...params) {
        if (this.rnio.options.http.enabled) {
            let route = new Route(...params);
            let methods = allHttpMethods;
            // Support both object and 'old' style route defnition.
            if (typeof params[0] === 'object' && params.length > 1) {
                methods = params[1];
            } else if (params.length > 3) {
                methods = params[3];
            }
            methods.forEach((method) => {
                this.defFull(this.httpPath(method, path), route);
            });
        }
    }

    /**
     * Copies route definition from specified path to specified path.
     * This function only copies http methods specified (or all).
     * For websocket paths use `wsCopy()` instead,
     * to copy to path of both http and websocket use `copy()` instead.
     * @param {string} path relative path to copy to.
     * @param {string} copyPath relative or absolute path to copy routing function from.
     * @param {string[]} [methods] the http methods to copy. (default: all)
     * @param {boolean} [absoluteSearch] search copy function with absolute path (default: false)
     */
    httpCopy(path, copyPath, methods = allHttpMethods, absoluteSearch = false) {
        methods.forEach((method) => {
            let searchPath = absoluteSearch ? copyPath : this.httpPath(method, copyPath); 
            let route = this.rnio.routes.get(searchPath);
            if (route) {
                this.defFull(this.httpPath(method, path), route);
            }
        });
    }

    /**
     * Get the absolute http special path, 
     * based on the method and relative path provided.
     * @param {string} method the http method.
     * @param {string} path the relative path to convert.
     * @returns the absolute http path.
     */
    httpPath(method, path) {
        return 'HTTP|' + method + ':' + this.path + path;
    }

    /**
     * Defines / registers a full route specified.
     * This route functions only for http connections.
     * @param {string} method the http method to register on.
     * @param {string} path the relative path to register on.
     * @param {...any} route the route to register.
     */
    httpDef(method, path, ...routedef) {
        if (this.rnio.options.http.enabled) this.defFull(this.httpPath(method, path), new Route(...routedef));
    }

    //=====================================================\\
    //				        WebSocket		       		   \\
    //=====================================================\\

    /**
     * Registers a specific route for websocket only.
     * @param {string} path the path to register at.
     * @param  {...any} route the route to register. (See `Route`)
     */
    ws(path, ...route) {
        this.wsDef(path, ...route);
    }

    /**
     * Copies route definition from specified path to specified path
     * for websocket methods only. For http paths use `httpCopy()` instead,
     * to copy to path of both http and websocket use `copy()` instead.
     * @param {string} path relative path to copy to.
     * @param {string} copyPath relative or absolute path to copy routing function from.
     * @param {boolean} [absoluteSearch] search copy function with absolute path (default: false)
     */
    wsCopy(path, copyPath, absoluteSearch = false) {
        let searchPath = absoluteSearch ? copyPath : this.wsPath(copyPath);
        let route = this.rnio.routes.get(searchPath);
        if (route) {
            this.defFull(this.wsPath(path), route);
        }
    }

    /**
     * Get the absolute websocket special path, based on the relative path provided.
     * @param {string} path the relative path to convert.
     * @returns the absolute websocket path.
     */
    wsPath(path) {
        return 'WS' + ':' + this.path + path;
    }

    /**
     * Defines / registers a full route specified.
     * This function only defines a route for websocket connections.
     * @param {string} path the relative path to register on.
     * @param {...any} routedef the route to register. (See `Route`)
     */
    wsDef(path, ...routedef) {
        if (this.rnio.options.websocket.enabled) this.defFull(this.wsPath(path), new Route(...routedef));
    }

    //=====================================================\\
    //				          Both		       	    	   \\
    //=====================================================\\

    /**
     * Registers a route on http 'GET' method and websocket
     * on specified path.
     * @param {string} path the path to register on.
     * @param  {...any} route the route definition. (See `Route`)
     */
    get(path, ...route) {
        this.def('GET', path, ...route);
    }

    /**
     * Registers a route on http 'HEAD' method and websocket
     * on specified path.
     * @param {string} path the path to register on.
     * @param  {...any} route the route definition. (See `Route`)
     */
    head(path, ...route) {
        this.def('HEAD', path, ...route);
    }

    /**
     * Registers a route on http 'POST' method and websocket
     * on specified path.
     * @param {string} path the path to register on.
     * @param  {...any} route the route definition. (See `Route`)
     */
    post(path, ...route) {
        this.def('POST', path, ...route);
    }

    /**
     * Registers a route on http 'PUT' method and websocket
     * on specified path.
     * @param {string} path the path to register on.
     * @param  {...any} route the route definition. (See `Route`)
     */
    put(path, ...route) {
        this.def('PUT', path, ...route);
    }

    /**
     * Registers a route on http 'PATCH' method and websocket
     * on specified path.
     * @param {string} path the path to register on.
     * @param  {...any} route the route definition. (See `Route`)
     */
    patch(path, ...route) {
        this.def('PATCH', path, ...route);
    }

    /**
     * Registers a route on http 'DELETE' method and websocket
     * on specified path.
     * @param {string} path the path to register on.
     * @param  {...any} route the route definition. (See `Route`)
     */
    delete(path, ...route) {
        this.def('DELETE', path, ...route);
    }

    /**
     * Registers a route on http 'OPTIONS' method and websocket
     * on specified path.
     * @param {string} path the path to register on.
     * @param  {...any} route the route definition. (See `Route`)
     */
    options(path, ...route) {
        this.def('OPTIONS', path, ...route);
    }

    /**
     * Registers a route on http 'TRACE' method and websocket
     * on specified path.
     * @param {string} path the path to register on.
     * @param  {...any} route the route definition. (See `Route`)
     */
    trace(path, ...route) {
        this.def('TRACE', path, ...route);
    }

    /**
     * Registers a specified route on all or all specified
     * http methods at specified path and websocket on that same specified path.
     * @param {string} path the path to register on.
     * @param {...any} params split array of params:  
     *   Either:  
     *   {Function} route - the route function.  
     *   {any} [paramdefs] - the definitions of the params. (Default: empty)  
     *   {string[]} [permssions] - list of required permissions. (Default: empty)  
     *   {string[]} [methods] - list of http methods to register on (Defualt: all)  
     *   Or:  
     *   {any} Route - an object specifying the route definition.  
     *   {string[]} [methods] - list of http methods to register on (Defualt: all)
     */
    all(path, ...params) {
        let route = new Route(...params);
        if (this.rnio.options.http.enabled) {
            let methods = allHttpMethods;
            // Support both object and 'old' style route defnition.
            if (typeof params[0] === 'object' && params.length > 1) {
                methods = params[1];
            } else if (params.length > 3) {
                methods = params[3];
            }
            methods.forEach((method) => {
                this.defFull(this.httpPath(method, path), route);
            });
        }
        if (this.rnio.options.websocket.enabled) this.defFull(this.wsPath(path), route);
    }

    /**
     * Copies route definition from specified path to specified path.
     * This function copies websocket paths too. If you just want to copy
     * http paths use `httpCopy()` instead.
     * @param {string} path relative path to copy to.
     * @param {string} copyPath relative or absolute path to copy routing function from.
     * @param {string[]} [methods] the http methods to copy. (default: all)
     * @param {boolean} [absoluteSearch] search copy function with absolute path (default: false)
     */
    copy(path, copyPath, methods = allHttpMethods, absoluteSearch = false) {
        this.httpCopy(path, copyPath, methods, absoluteSearch);
        this.wsCopy(path, copyPath, absoluteSearch);
    }

    /**
     * Defines / registers a full route.
     * Arguments can be either a route object or an argument
     * array with function, params and permissions.
     * @param {string} method the http method to register on.
     * @param {string} path the relative path to register on.
     * @param  {...any} routedef the routedefinition to register. (See `Route`)
     */
    def(method, path, ...routedef) {
        this.defRoute(method, path, new Route(...routedef));
    }

    /**
     * Defines / registers a full route specified with a Route object.
     * This route functions for both the http function specified
     * and a websocket request at the same path.
     * @param {string} method the http method to register on.
     * @param {string} path the relative path to register on.
     * @param {Route} route the route to register.
     */
    defRoute(method, path, route) {
        if (this.rnio.options.http.enabled) this.defFull(this.httpPath(method, path), route);
        if (this.rnio.options.websocket.enabled) this.defFull(this.wsPath(path), route);
    }

    //=====================================================\\
    //				         Special		       	   	   \\
    //=====================================================\\

    /**
     * Imports & registers another router to a relative path.
     * You can enter empty string or nothing for path, to 
     * stack / merge routers.
     * @param {string} path 
     * @param {Function} router 
     * @param {boolean} [copy] - wether or not to copy index
     * of imported router to non trailing slash. If true
     * is specified /dogs will for instance redirect to /dogs/.
     */
    use(path, router, copy = false) {
        // Support stacking router by specifing no path.
        if (typeof path === 'function') {
            copy = router; router = path; path = '';
        }
        // If router is proper router function, execute and copy if specified.
        if (typeof router === 'function') {
            router(new Router(this.rnio, this.path + path), this.rnio);
            if (copy) this.copy(this.path + path, this.path + path + '/');
        } else {
            throw 'Could not initialise router!';
        }
    }

    /**
     * Defines a full route to the parent restnio instance.
     * @param {string} fullpath the fullpath to register on.
     * @param {Route} route the routing properties that happen on sepecief path.
     */
    defFull(fullpath, route) {
        this.rnio.routes.set(fullpath, route);
    }

}
module.exports = Router;