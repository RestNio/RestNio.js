/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

 'use strict';

const Route = require('./Route');
const allHttpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * @class Router
 * @author 7kasper
 * @classdesc
 * Represents a router. A router is an easy way to add
 * routes to the restnio's routing map.
 * @constructor
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
        this.defFull(this.httpPath(method, path), new Route(...routedef));
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
        this.defFull(this.wsPath(path), new Route(...routedef));
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
        this.defFull(this.wsPath(path), route);
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
     * and a websocket request at the same path (if doWebsocket).
     * @param {string} method the http method to register on.
     * @param {string} path the relative path to register on.
     * @param {Route} route the route to register.
     */
    defRoute(method, path, route) {
        this.defFull(this.httpPath(method, path), route);
        if (this.rnio.doWebsocket) this.defFull(this.wsPath(path), route);
    }

    //=====================================================\\
    //				         Special		       	   	   \\
    //=====================================================\\

    /**
     * Imports & registers another router to a relative path.
     * You can enter empty string for path, to stack / merge
     * routers.
     * @param {string} path 
     * @param {Function} router 
     */
    use(path, router) {
        router(new Router(this.rnio, this.path + path));
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