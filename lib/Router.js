/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';
const Route = require('./Route');

class Router {

    constructor(rnio, path = '') {
        this.rnio = rnio;
        this.path = path;
    }

    use(path, router) {
        router(new Router(this.rnio, this.path + path));
    }

    get(path, params, permissions, func) {
        this.def('get', path, params, permissions, func);
    }

    post(path, params, permissions, func) {
        this.def('post', path, params, permissions, func);
    }

    put(path, params, permissions, func) {
        this.def('put', path, params, permissions, func);
    }

    patch(path, params, permissions, func) {
        this.def('patch', path, params, permissions, func);
    }

    delete(path, params, permissions, func) {
        this.def('delete', path, params, permissions, func);
    }

    def(method, path, params, permissions, func) {
        this.defFull(method + ':' + this.path + path, params, permissions, func)
    }

    /**
     * Defines a full route.
     */
    defFull(fullpath, params, permissions, func) {
        this.rnio.routes.set(fullpath, new Route(fullpath, params, permissions, func));
    }

}
module.exports = Router;