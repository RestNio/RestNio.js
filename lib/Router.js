/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

const Route = require('./Route');

/**
 * @class Router
 * @classdesc
 * Represents a router. A router is an easy way to add
 * routes to the restnio's routing map.
 * @constructor
 * @param {RestNio} rnio the restnio object to bind on.
 * @param {string} path the relative path to work on.
 */
class Router {

    /**
     * Gets all default supported http methods.
     */
    static allMethods() {
        return ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    }

    constructor(rnio, path = '') {
        this.rnio = rnio;
        this.path = path;
    }

    use(path, router) {
        router(new Router(this.rnio, this.path + path));
    }

    // HTTP
    httpGet(path, func, params = [], permissions = []) {
        this.httpDef('GET', path, new Route(func, params, permissions));
    }

    httpPost(path, func, params = [], permissions = []) {
        this.httpDef('POST', path, new Route(func, params, permissions));
    }

    httpPut(path, func, params = [], permissions = []) {
        this.httpDef('PUT', path, new Route(func, params, permissions));
    }

    httpPatch(path, func, params = [], permissions = []) {
        this.httpDef('PATCH', path, new Route(func, params, permissions));
    }

    httpDelete(path, func, params = [], permissions = []) {
        this.httpDef('DELETE', path, new Route(func, params, permissions));
    }

    httpAll(path, func, params = [], permissions = [], methods = Router.allMethods()) {
        let route = new Route(func, params, permissions);
        methods.forEach((method) => {
            this.httpDef(method, path, route);
        });
    }

    httpCopy(path, copyPath, methods = Router.allMethods()) {
        methods.forEach((method) => {
            let route = this.rnio.routes.get(this.httpPath(method, copyPath));
            if (route) {
                this.httpDef(method, path, route);
            }
        });
    }

    httpPath(method, path) {
        return 'HTTP|' + method + ':' + this.path + path;
    }

    httpDef(method, path, route) {
        this.defFull(this.httpPath(method, path), route);
    }

    // WSS
    wsGet(path, func, params = [], permissions = []) {
        this.wsDef('GET', path, new Route(func, params, permissions));
    }

    wsPost(path, func, params = [], permissions = []) {
        this.wsDef('POST', path, new Route(func, params, permissions));
    }

    wsPut(path, func, params = [], permissions = []) {
        this.wsDef('PUT', path, new Route(func, params, permissions));
    }

    wsPatch(path, func, params = [], permissions = []) {
        this.wsDef('PATCH', path, new Route(func, params, permissions));
    }

    wsDelete(path, func, params = [], permissions = []) {
        this.wsDef('DELETE', path, new Route(func, params, permissions));
    }

    wsAll(path, func, params = [], permissions = [], methods = Router.allMethods()) {
        let route = new Route(func, params, permissions);
        methods.forEach((method) => {
            this.wsDef(method, path, route);
        });
    }

    wsCopy(path, copyPath, methods = Router.allMethods()) {
        methods.forEach((method) => {
            let route = this.rnio.routes.get(this.wsPath(method, copyPath));
            if (route) {
                this.wsDef(method, path, route);
            }
        });
    }

    wsPath(method, path) {
        return 'WS|' + method + ':' + this.path + path;
    }

    wsDef(method, path, route) {
        this.defFull(this.wsPath(method, path), route);
    }

    // BOTH
    get(path, func, params = [], permissions = []) {
        this.def('GET', path, new Route(func, params, permissions));
    }

    post(path, func, params = [], permissions = []) {
        this.def('POST', path, new Route(func, params, permissions));
    }

    put(path, func, params = [], permissions = []) {
        this.def('PUT', path, new Route(func, params, permissions));
    }

    patch(path, func, params = [], permissions = []) {
        this.def('PATCH', path, new Route(func, params, permissions));
    }

    delete(path, func, params = [], permissions = []) {
        this.def('DELETE', path, new Route(func, params, permissions));
    }

    all(path, func, params = [], permissions = [], methods = Router.allMethods()) {
        let route = new Route(func, params, permissions);
        methods.forEach((method) => {
            this.def(method, path, route);
        });
    }

    copy(path, copyPath, methods = Router.allMethods()) {
        this.httpCopy(path, copyPath, methods);
        this.wsCopy(path, copyPath, methods);
    }

    def(method, path, route) {
        this.defFull(this.httpPath(method, path), route);
        this.defFull(this.wsPath(method, path), route);
    }

    /**
     * Defines a full route.
     */
    defFull(fullpath, route) {
        this.rnio.routes.set(fullpath, route);
    }

}
module.exports = Router;