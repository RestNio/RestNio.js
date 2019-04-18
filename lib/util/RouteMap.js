/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

// TODO: Make routes regexable and add in-url params.

'use strict';

// Imports
const _ = require('lodash');

// Consts
//Regex to detect optional regex flags in to be registered urls.
const regflags = /:\[([gimsxU]+)\]\//;
//Regex to detect varnames in to be registered urls.
const regvarname = /\$([a-zA-Z_$][0-9a-zA-Z_$]*)/g; 
//Regex to detect special stars that match any word in to be registred urls.
const regstar = /\/\*\//g;
//Regex to detect ending stars that match everything after x in to be registred urls.
const reglonelystar = /\/\*$/g;


/**
 * @class RouteMap
 * @author 7kasper
 * @classdesc
 * Special map implementation for routes.
 * Routes are stored internally as register string -> route,
 * however all default map functions have been replaced
 * to support regex and path-parameter functions.
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
            let routes = []; let pathParams = {};
            for (const rex of this.keys()) {
                let match = rex.exec(path);
                if (match != null) {
                    pathParams = _.defaultsDeep(match.groups, pathParams);
                    routes.push(super.get(rex));
                }
            }
            // Add 404 routes if no functions are found.
            if (routes.length == 0 && path !== '404') {
                return this.get('404');
            }
            return {pathParams, routes};
        } else if (path instanceof RegExp) {
            return super.get(path);
        } else {
            throw `Unsupported path! (${path})`;
        }
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
        // Extract optional flags
        let flags = regflags.exec(str);
        if (flags) {
            flags = flags[1];
            str = str.replace(`[${flags}]`, '');
        } else { 
            flags = '';
        }
        // Setup all variables
        let match = regvarname.exec(str);
        while(match != null) {
          str = str.replace(match[0], `(?<${match[1]}>\\w*)`);
          match = regvarname.exec(str);
        }
        // 'Fix' lonely stars
        str = str.replace(regstar, '\/\\w*');
        // 'Fix' ending stars
        str = str.replace(reglonelystar, '/.*');
        console.dir(flags);
        console.dir(str);
        return new RegExp(`^${str}$`, flags);
    }

}
module.exports = RouteMap;