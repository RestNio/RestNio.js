/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

// TODO: Make routes regexable and add in-url params.

'use strict';

// Constants
const k = 0;
const v = 1;

/**
 * @class RouteMap
 * @author 7kasper
 * @classdesc
 * Special map implementation for routes.
 * Routes are stored internally as register string -> route,
 * however all default map functions have been replaced
 * to support regex and url-parameter functions.
 */
class RouteMap extends Map {

    set(path, route) {
        if (path instanceof RegExp) {
            super.put(path, route);
        } else if (typeof path === 'string') {
            super.put(bakeRegex(path), route);
        }
    }

    static bakeRegex(str) {
        
    }

}
module.exports = RouteMap;