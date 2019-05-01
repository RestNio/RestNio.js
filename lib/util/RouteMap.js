/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

// Imports
const _ = require('lodash');

// Consts
//Regex to detect optional regex flags in to be registered urls.
const regflags = /:\[([gimsxU]+)\]\//;
//Regex to detect varnames in to be registered urls.
const regvarname = /(?<=\/)\:([a-zA-Z_$][0-9a-zA-Z_$]*)/g; 
//Regex to detect special stars that match any word in to be registred urls.
const regstar = /\/\*\//g;
//Regex to detect ending stars that match everything after x in to be registred urls.
const reglonelystar = /\/\*$/g;


/**
 * @class RouteMap
 * @extends Map
 * @author 7kasper
 * @classdesc
 * Special map implementation for routes.
 * Routes are stored internally as register RegExp -> route,
 * All default map functions have been suplemented
 * to support regex and path-parameter functions.
 */
class RouteMap extends Map {

    /**
     * Registers / sets a certain route to a certain map.
     * If instead of a regex a string is provided it will be
     * baked following using the `bakeRegex()`
     * @param {string} path 
     * @param {*} route 
     * @returns this map.
     */
    set(path, route) {
        if (path instanceof RegExp) {
            super.set(path, route);
        } else if (typeof path === 'string') {
            super.set(RouteMap.bakeRegex(path), route);
        } else {
            throw `Unsupported path! (${path})`; 
        }
        return this;
    }

    /**
     * Checks if there are one or more routes belonging
     * to the specified path.
     * @param {string} path
     * @returns true, if the map contains a match.
     */
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

    /**
     * Gets all routes belonging to a certain path and
     * returns the path parameters.
     * 
     * This function is a bit different from a 'normal' get
     * as it compiles not only an array of matched routes, but
     * also an object containing all path-parameters specified by
     * those routes in merged formfactor.
     * 
     * If the provided path is given in RegExp form the function
     * will act as expected from a normal map.
     * 
     * @param {string} path
     * @returns an object contiaining all matched 'routes'
     * and a merged array of all 'pathParams'
     */
    get(path) {
        if (typeof path === 'string') {
            let routes = []; let pathParams = {};
            // Cycle through all regexes and find all matching routes.
            for (const rex of this.keys()) {
                let match = rex.exec(path);
                if (match != null) {
                    pathParams = _.defaultsDeep(match.groups, pathParams);
                    routes.push(super.get(rex));
                }
            }
            return {pathParams, routes};
        } else if (path instanceof RegExp) {
            return super.get(path);
        } else {
            throw `Unsupported path! (${path})`;
        }
    }

    /**
     * Deletes all revords matching a certain path from this routing map.
     * Though not recommended the routingmap can be
     * altered 'on the fly'. This method will delete
     * all methods belonging to a regex matching with the specified path.
     * If a regex is specified as path only the exact match will be deleted.
     * 
     * @param {string} path
     * @returns true if a match has been deleted, false if not.
     */
    delete(path) {
        if (typeof path === 'string') {
            let found = false;
            // Cycle through all regexes and delete matches.
            for (const rex of this.keys()) {
                if (rex.test(path)) {
                    found = true;
                    super.delete(rex);
                }
            }
            return found;
        } else if (path instanceof RegExp) {
            return super.delete(path);
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
     * :variable - matches url variables
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
          str = str.replace(match[0], `(?<${match[1]}>[^\\/]*)`);
          match = regvarname.exec(str);
        }
        // 'Fix' middle stars
        str = str.replace(regstar, '\/\\w*');
        // 'Fix' ending stars
        str = str.replace(reglonelystar, '/.*');
        return new RegExp(`^${str}$`, flags);
    }

}
module.exports = RouteMap;