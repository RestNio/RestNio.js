/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

/**
 * @class Route
 * @classdesc
 * Represents a route. This is stored with all routes
 * in the routing map of a RestNio instance.
 * 
 * This class is, bescides storing method and params,
 * responsible for performing parameter and security
 * functions before executing the registered function.
 * @constructor
 * @param {function} func the actual function to perform on this route.
 * @param {param[]} params the params this function works with.
 * @param {permission[]} permissions the permissions required to execute this function.
 */
class Route {

    /**
     * Creates a route object using a variable route definition.
     * @param  {...any} routedef Definition of the route.  
     *   Either:  
     *   {Function} route - the route function.  
     *   {any} [params] - the definitions of the params. (Default: empty)  
     *   {string[]} [permissions] - list of required permissions. (Default: empty)  
     *   Or:  
     *   {any} Route - an object specifying the route definition.
     */
    constructor(...routedef) {
        this.func = () => {};
        this.params = {};
        this.permissions = [];
        console.log(routedef);
        if (typeof routedef[0] === 'object') {
            if (routedef[0].func) this.func = routedef[0].func;
            if (routedef[0].params) this.params = routedef[0].params;
            if (routedef[0].permissions) this.permissions = routedef[0].permissions;
        } else {
            if (routedef[0]) this.func = routedef[0];
            if (routedef[1]) this.params = routedef[1];
            if (routedef[2]) this.permissions = routedef[2];
        }
    }

}
module.exports = Route;