/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

// Imports
require('../client/Client');

/**
 * @typedef {import("../client/Client")} Client
 */

 /**
 * @typedef RouteDef
 * @property {RouteFunc} func - the function of this route.
 * @property {Object.<string, RouteDef>} [params] - a map of the possible
 * and required parameter names pointing to the definitions
 * belonging to them.
 * @property {string[]} [permissions] - the permissions required
 * to access this route.<br/><br/>
 * Permissions are checked before actually
 * executing the route. Only clients with the required token-verified
 * permissions will be allowed in. Permissions look like this:
 * `dog.:breed.feed` where `:parameter` substitutions can be used
 * to create parameter-specefic permissions.
 * @property {boolean} [isActive=true] - whether a route is active.
 * A good rule of thumb is that a route should NOT be active
 * if it does NOT return anything under normal operating instances.
 * A route is active per default.
 */

/**
 * Callback that lays out the format for a route function.
 * @callback RouteFunc
 * @param {Object[]} params - the parameters for the function.
 * @param {Client} client - the client executing the function.
 * @returns {Object} - returning an object is not required, but
 * can serve multiple functions and is often the most easy to use.
 * If you return a `string` it will be piped through as plain text 
 * to the client. Any object will be send JSON-encoded.
 * If a routefunc returns `Infinity` a pipe with the client 
 * will be held open. This way you can use the client object
 * directly to to handle and close the connection.
 */

/**
 * @typedef ParamDef
 * @property {boolean} [required=false] - whether the param is required or not.
 * @property {(ParamDefault|number|string|Date|null|undefined|boolean)} [default] - the default value for this
 * parameter if it isn't present. This can return a straight object or be a function
 * accepting the parameter name and returning some default object. If the default
 * is specified as this function, it will be executed each time the default value
 * is generated.
 * @property {string} [type] - what type the variable should be in.
 * Please note this is passed in a straight up into a typeof operator rejecting
 * a parameter if the type is not correct. When unset (undefined), variable type will
 * not be checked. Note: URL/Path parameters are always a string type. In some
 * cases it might be advisable to type-check inside a post-check or format function
 * after casting is done.
 * @property {ParamCheck[]} [prechecks] - similar to checks. The prechecks are
 * a list of checks that get executed before a value is further parsed and
 * formatted by the formatters. This is usefull to for instance pre-fail
 * parameters even before they are formatted.
 * Checks can be stacked and are performed in order of the array.
 * @property {ParamFormatter[]} [formatters] - formatters are functions
 * used to format or parse the param further. For instance creating
 * a date object from a timestamp or datestring. Formatters can be stacked and
 * are applied in the order of the array.
 * @property {ParamCheck[]} [prechecks] - similar to prechecks. The checks are
 * a list of checks that get executed after a value is parsed and
 * formatted by the formatters. This is usefull to check illigal dates for instance.
 * Checks can be stacked and are performed in order of the array.
 */

/**
 * Function that gives a default for a certain param.
 * @callback ParamDefault
 * @param {string} paramname - the name of the parameter.
 * @returns {Object} the (generated) default parameter
 */

/**
 * Function that checks a parameter.
 * @callback ParamCheck
 * @param {Object} param - the value of the parameter to check.
 * @param {string} [paramname] - the name of the parameter to be checked.
 * @param {function} [reject] - optional function used to reject / fail a check
 * you can also just use `throw`.
 * @param {number} [index] - the index of this check. Mostly usefull for your
 * own debugging purposes.
 * @returns {boolean} false, if a check has failed. `throw` or the `reject` function
 * can be used to output a specific message. Otherwise a check might
 * just return a boolean that causes a generic fail to occur.
 */

 /**
 * Function that formats a parameter.
 * @callback ParamFormatter
 * @param {Object} param - the value of the parameter to check.
 * @param {string} [paramname] - the name of the parameter to be checked.
 * @param {function} [reject] - optional function used to reject / fail a check
 * you can also just use `throw`. Note that if a param is rejected,
 * it will not be formatted further.
 * @param {number} [index] - the index of this check. Mostly usefull for your
 * own debugging purposes.
 * @returns {object} the param, with formats applied. If `throw` or the `reject` function
 * are used the parameter will not be formatted further.
 */

/**
 * @exports Route
 * @class Route
 * @classdesc
 * Represents a route. This is stored with all routes
 * in the routing map of a RestNio instance.
 * 
 * This class is, bescides storing method and params,
 * responsible for performing parameter and security
 * functions before executing the registered function.
 */
class Route {

    /**
     * Creates a route object using either a defining `RouteDef` object
     * or by specifying the required definitions spreaded out into the constructor.
     * @param {(RouteDef|RouteFunc)} routedef - either the main route function
     * that is to be executed or the full definition provided in style of a `RouteDef`.
     * @param {Object.<string, RouteDef>} [params] - if spreading out, an optional map
     * of parameter definitions.
     * @param {string[]} [permissions] - if spreading out, an optional set of permissions.
     * @param {boolean} [isActive] - if spreading out, an optional chance to define
     * the route to be inactive.
     */
    constructor(routedef, params = {}, permissions = [], isActive = true) {

        /**
         * the function of this route.
         * @name Route#func
         * @type RouteFunc
         */
        this.func = routedef;
        /**
         * a map of the possible
         * and required parameter names pointing to the definitions
         * belonging to them.
         * @name Route#params
         * @type Object.<string, RouteDef>
         * @default {}
         */
        this.params = params;
        /**
         * the permissions required
         * to access this route.<br/><br/>
         * Permissions are checked before actually
         * executing the route. Only clients with the required token-verified
         * permissions will be allowed in. Permissions look like this:
         * `dog.:breed.feed` where `:parameter` substitutions can be used
         * to create parameter-specefic permissions.
         * @name Route#permissions
         * @type string[]
         * @default []
         */
        this.permissions = permissions;
        /** 
         * whether a route is active.
         * A good rule of thumb is that a route should NOT be active
         * if it does NOT return anything under normal operating instances.
         * A route is active per default.
         * @name Route#isActive
         * @type boolean
         * @default true
        */
        this.isActive = isActive;

        if (typeof routedef === 'object') {
            if (routedef.func) this.func = routedef[0].func;
            if (routedef.params) this.params = routedef[0].params;
            if (routedef.permissions) this.permissions = routedef[0].permissions;
            if (routedef.isActive !== undefined) this.isActive = routedef[0].isActive;
        }
    }

}
module.exports = Route;