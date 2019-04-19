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
        this.defFull(`${this.httpPrefix(methods)}:${this.path}${path}`, new Route((params, client) => {
            client.redirect(location, code);
        }));
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
     * @param {...any} route the route to register.
     */
    httpDef(method, path, ...routedef) {
        if (this.rnio.options.http.enabled) {
            this.defFull(`${this.httpPrefix([method.toUpperCase()])}:${this.path}${path}`, new Route(...routedef));
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
     * @param  {...any} route the route to register. (See `Route`)
     */
    ws(path, ...route) {
        if (this.rnio.options.websocket.enabled) {
            this.defFull(`${this.wsPrefix()}:${this.path}${path}`, new Route(...route));
        }
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
        if (this.rnio.options.http.enabled || this.rnio.options.websocket.enabled) {
            let route = new Route(...params);
            let methods = allHttpMethods;
            // Support both object and 'old' style route defnition.
            if (typeof params[0] === 'object' && params.length > 1) {
                methods = params[1];
            } else if (params.length > 3) {
                methods = params[3];
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
        this.httpRedirect(path, location, code. absolute, methods);
        this.wsRedirect(path, location, code, absolute);
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
        if (this.rnio.options.http.enabled || this.rnio.options.websocket.enabled) {
            this.defFull(`${this.prefix([method.toUpperCase()])}:${this.path}${path}`, new Route(...routedef));
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
     * @param {string} [path] - the path to register the route on. Defaults to ''.
     * @param {Function} router - The actual router function to use.
     * @param {boolean} [redirect] - wether or not to redirect index
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
            if (redirect) this.redirect(this.path + path, this.path + path + '/');
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
Router.allHttpMethods = allHttpMethods;
module.exports = Router;