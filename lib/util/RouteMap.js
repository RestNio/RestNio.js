/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

// TODO: Make routes regexable and add in-url params.

'use strict';

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
            super.set(path, route);
        } else if (typeof path === 'string') {
            super.set(RouteMap.bakeRegex(path), route);
        } else {
            throw `Unsupported path! (${path})`; 
        }
    }

    has(path) {
        if (typeof path === 'string') {
            for (const rex of this.keys()) {
                if (rex.test(path)) return true;
            }
        } else if (path instanceof RegExp) {
            return super.has(path);
        } else {
            throw `Unsupported path! (${path})`;
        }
        return false;
    }

    get(path) {
        if (typeof path === 'string') {
            for (const rex of this.keys()) {
                let match = rex.exec(path);
                if (match != null) {
                    // URL params: match.groups
                    console.dir(match.groups);
                    return super.get(rex);
                }
            }
        } else if (path instanceof RegExp) {
            return super.get(path);
        } else {
            throw `Unsupported path! (${path})`;
        }
        console.log('NO WE DONT HAVE IT')
        return null;
    }

    /**
     * Transforms or bakes a regex from the specified string.
     * This regex supports two functions given in the string:
     * 
     * \* - matches all substrings
     * 
     * $variable - matches url variables
     * @param {string} str - the string to create regex from.
     * @returns a regex based on the url string. 
     */
    static bakeRegex(str) {
        let varname = /\$([a-zA-Z_$][0-9a-zA-Z_$]*)/g;
        let match = varname.exec(str);
        while(match != null) {
          str = str.replace(match[0], `(?<${match[1]}>\\w*)`);
          match = varname.exec(str);
        }
        str = str.replace(/\/\*(\/?)/g, '\/\\w*$1');
        return new RegExp(`^${str}$`);
    }

}
module.exports = RouteMap;