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
//Regex to detect named greedy ":foo**" varnames — captures both the index
//and everything under `/`. Mirrors lonely-`**` semantics but named.
//Must run BEFORE the single-star and plain varname forms, otherwise either
//would consume the leading colon-name and leave the stars dangling.
const regvarnameStarStar = /\:([a-zA-Z_$][0-9a-zA-Z_$]*)\*\*/g;
//Regex to detect named greedy ":foo*" varnames — captures everything under
//the preceding slash (including empty). Mirrors lonely-`/*` semantics but named.
const regvarnameStar = /(?<=\/)\:([a-zA-Z_$][0-9a-zA-Z_$]*)\*/g;
//Regex to detect varnames in to be registered urls.
const regvarname = /(?<=\/)\:([a-zA-Z_$][0-9a-zA-Z_$]*)/g;
//Regex to detect special stars that match any word in to be registred urls.
const regmiddlestar = /\/\*\//g;
//Regex to detect ending stars (/*) that match everything under x/ (but not x itself).
const reglonelystar = /\/\*$/g;
//Regex to detect trailing "/**" that matches everything under x/ (but not x itself).
//Handled before `reglonelystars` so the leading slash isn't consumed by the latter.
const regtrailingslashstars = /\/\*\*$/g;
//Regex to detect ending "**" (without a leading slash, e.g. `/api**`) that
//matches both the index `x` itself AND everything under `x/`.
const reglonelystars = /\*\*$/g;


/**
 * @exports RouteMap
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
     * Deletes all records matching a certain path from this routing map.
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
     * This regex supports the following patterns in the string:
     *
     * - `:variable` — matches a single url segment and captures it.
     * - `:variable*` — named greedy capture; matches everything under the
     *   preceding `/`, including empty. Captured group `<variable>`. Example:
     *   `/api/:rest*` matches `/api/`, `/api/a`, `/api/a/b`; the `rest` group
     *   captures the tail (`""`, `"a"`, `"a/b"`). Single-star form: rest must
     *   live after a slash.
     * - `:variable**` — named greedy capture; matches BOTH the index path
     *   itself AND everything under `/`. Captured group includes the leading
     *   slash when present. Example: `/api:rest**` matches `/api`, `/api/`,
     *   `/api/a`; `rest` captures `""`, `"/"`, `"/a"`.
     * - `/<star>/` (middle star) — matches exactly one url segment.
     * - `/<star>` at end — matches everything under `x/` (but NOT `x` itself).
     *   Example: `/api/<star>` matches `/api/a`, `/api/a/b`, `/api/`; not `/api`.
     * - `/<star><star>` at end — same as `/<star>` (everything under `x/`, not `x`).
     *   Example: `/api/<star><star>` matches `/api/a`, `/api/a/b`, `/api/`; not `/api`.
     * - `<star><star>` at end (no leading slash, e.g. `/api<star><star>`) — matches BOTH
     *   the index `x` AND everything under `x/`. Example: `/api<star><star>` matches
     *   `/api`, `/api/`, `/api/a`, `/api/a/b`.
     * (The literal characters are an asterisk — substitute mentally; writing
     * the real glyphs here would close this JSDoc block comment early.)
     * @param {string} str - the string to create regex from.
     * @returns a regex based on the url string.
     */
    static bakeRegex(str) {
        // Extract optional flags
        let flags = regflags.exec(str);
        if (flags) {
            flags = flags[1];
            str = str.replace(`:[${flags}]`, '');
        } else {
            flags = '';
        }
        // Named greedy ":foo**" — index + everything under, captured.
        // Run before single-star and plain varname so neither consumes the
        // leading colon-name and leaves the stars behind. Replacement absorbs
        // optional leading slash inside the group, mirroring the lonely-`**`
        // form (which uses `(?:\/.*)?`).
        let dsMatch = regvarnameStarStar.exec(str);
        while (dsMatch != null) {
            str = str.replace(dsMatch[0], `(?<${dsMatch[1]}>(?:\\/.*)?)`);
            dsMatch = regvarnameStarStar.exec(str);
        }
        // Named greedy ":foo*" — captures tail under preceding slash. Allows
        // empty tail to match the lonely-`/*` form. The leading `/` itself is
        // not consumed by the group; it stays literal in the surrounding pattern.
        let sMatch = regvarnameStar.exec(str);
        while (sMatch != null) {
            str = str.replace(sMatch[0], `(?<${sMatch[1]}>.*)`);
            sMatch = regvarnameStar.exec(str);
        }
        // Plain segment varnames.
        let match = regvarname.exec(str);
        while(match != null) {
          str = str.replace(match[0], `(?<${match[1]}>[^\\/]*)`);
          match = regvarname.exec(str);
        }
        // 'Fix' middle stars
        str = str.replace(regmiddlestar, '\/[^\\/]*\/');
        // 'Fix' trailing "/**" (requires a leading slash — does NOT match x itself).
        // Must run before the "**"-only pattern below, otherwise the latter
        // would consume only the stars and leave the slash dangling.
        str = str.replace(regtrailingslashstars, '/.*');
        // 'Fix' ending stars ("/*")
        str = str.replace(reglonelystar, '/.*');
        // 'Fix' ending double stars ("**" without a leading slash). Matches
        // both the index and everything under `x/`.
        str = str.replace(reglonelystars, '(?:\\/.*)?');
        return new RegExp(`^${str}$`, flags);
    }

}
module.exports = RouteMap;