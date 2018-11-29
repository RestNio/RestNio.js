/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';
const Route = require('./Route');

class Router {

    static allMethods() {
        return ['get', 'post', 'put', 'patch', 'delete'];
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
        this.httpDef('get', path, new Route(func, params, permissions));
    }

    httpPost(path, func, params = [], permissions = []) {
        this.httpDef('post', path, new Route(func, params, permissions));
    }

    httpPut(path, func, params = [], permissions = []) {
        this.httpDef('put', path, new Route(func, params, permissions));
    }

    httpPatch(path, func, params = [], permissions = []) {
        this.httpDef('patch', path, new Route(func, params, permissions));
    }

    httpDelete(path, func, params = [], permissions = []) {
        this.httpDef('delete', path, new Route(func, params, permissions));
    }

    httpAll(path, func, params = [], permissions = [], methods = Router.allMethods()) {
        let route = new Route(func, params, permissions);
        methods.forEach((method) => {
            this.httpDef(method, path, route);
        });
    }

    httpDef(method, path, route) {
        this.defFull('http|' + method + ':' + this.path + path, route);
    }

    // WSS
    wsGet(path, func, params = [], permissions = []) {
        this.wsDef('get', path, new Route(func, params, permissions));
    }

    wsPost(path, func, params = [], permissions = []) {
        this.wsDef('post', path, new Route(func, params, permissions));
    }

    wsPut(path, func, params = [], permissions = []) {
        this.wsDef('put', path, new Route(func, params, permissions));
    }

    wsPatch(path, func, params = [], permissions = []) {
        this.wsDef('patch', path, new Route(func, params, permissions));
    }

    wsDelete(path, func, params = [], permissions = []) {
        this.wsDef('delete', path, new Route(func, params, permissions));
    }

    wsAll(path, func, params = [], permissions = [], methods = Router.allMethods()) {
        let route = new Route(func, params, permissions);
        methods.forEach((method) => {
            this.wsDef(method, path, route);
        });
    }

    wsDef(method, path, route) {
        this.defFull('ws|' + method + ':' + this.path + path, route);
    }

    // BOTH
    get(path, func, params = [], permissions = []) {
        this.def('get', path, new Route(func, params, permissions));
    }

    post(path, func, params = [], permissions = []) {
        this.def('post', path, new Route(func, params, permissions));
    }

    put(path, func, params = [], permissions = []) {
        this.def('put', path, new Route(func, params, permissions));
    }

    patch(path, func, params = [], permissions = []) {
        this.def('patch', path, new Route(func, params, permissions));
    }

    delete(path, func, params = [], permissions = []) {
        this.def('delete', path, new Route(func, params, permissions));
    }

    all(path, func, params = [], permissions = [], methods = Router.allMethods()) {
        let route = new Route(func, params, permissions);
        methods.forEach((method) => {
            this.def(method, path, route);
        });
    }

    def(method, path, route) {
        this.defFull('http|' + method + ':' + this.path + path, route);
        this.defFull('ws|' + method + ':' + this.path + path, route);
    }

    /**
     * Defines a full route.
     */
    defFull(fullpath, route) {
        this.rnio.routes.set(fullpath, route);
    }

}
module.exports = Router;