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

    constructor(func, params = [], permissions = []) {
        this.func = func;
        this.params = params;
        this.permissions = permissions;
    }

    /**
     * Executes the func after all checks and balances are dealt with.
     */
    exec() {
        
    }

}
module.exports = Route;