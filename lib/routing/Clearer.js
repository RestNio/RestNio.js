/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

const paramPermissionRegex = /\$([^., ,-]+)/g;

/**
 * @class Parser
 * @author 7kasper
 * @classdesc
 * Utility class to 'clear' a route before its function gets executed.
 * Clearing entails that permissions are checked, parameters are verified
 * by the checks and pre-checks inside the route-definition and also
 * that the parameters are sanitised and formatted also according to
 * the route definition. All these checks are in this clearing-class
 * splitted into a few methods.
 */
class Clearer {

    /**
     * Verifies all non-parameter specific permissions
     * and compiles a list of all not-yet-checked
     * parameter specific permissions.
     * The parameter specific permissions ought to be checked
     * after the parameters have been checked and sanitiz
     * @param {string[]} requiredPermissions 
     * @param {PermissionSet} clientPermissions 
     */
    static clearPermissions(requiredPermissions, clientPermissions) {
        return new Promise((resolve, reject) => {
            let paramPermissions = new Set();
            requiredPermissions.forEach(requiredPermission => {
                if (paramPermissionRegex.test(requiredPermission)) {
                    paramPermissions.add(requiredPermission);
                } else if (!clientPermissions.has(requiredPermission)) {
                    reject('Missing permission: "' + requiredPermission + '"!');
                }
            });
            resolve(paramPermissions);
        });
    }

    /**
     * Verifies the client has all parameter specic permissions.
     * This is usually a list of parameters generated by the function
     * `clearPermissions();` 
     * @param {string[]} paramPermissions 
     * @param {PermissionSet} clientPermissions 
     * @param {any[]} params 
     */
    static clearParamPermissions(paramPermissions, clientPermissions, params) {
        return new Promise((resolve, reject) => {
            paramPermissions.forEach(paramPermission => {
                let requiredPermission = paramPermission.replace(paramPermissionRegex, (match, paramname) => {
                    return params[paramname];
                });
                if (!clientPermissions.has(requiredPermission)) {
                    reject('Missing param-permission: "' + requiredPermission + '"!');
                }
            });
            resolve();
        });
    }

    /**
     * Verifies and sanitises all params.
     * @param {any[]} paramdefs 
     * @param {any[]} params 
     */
    static clearParams(paramdefs, params) {
        process.stdout.write('<-'); console.log(params); //TODO remove debug.
        return new Promise((resolve, reject) => {
            // Checks & Formatters
            Object.keys(paramdefs).forEach(paramname => {
                let paramdef = paramdefs[paramname];
                let param = params[paramname];
                params[paramname] = this.clearParam(paramdef, param, paramname, reject);
            });
            resolve(params);
        });
    }

    /**
     * Verifies and sanitises a param.
     * @param {any} paramdef 
     * @param {any} param 
     * @param {String} paramname 
     * @param {Function} reject 
     */
    static clearParam(paramdef, param, paramname, reject) {
        // Present check
        if (param === undefined) {
            if (paramdef.required) {
                reject('Missing param "' + paramname + '"!');
            } else if (paramdef.default !== undefined) {
                param = paramdef.default;
            }
        } else {
            // Type check
            if (paramdef.type !== undefined && typeof param !== paramdef.type) {
                reject('Incorrect param type: ' + typeof param + ', "' + paramname + '" should be ' + paramdef.type + '!')
            }
            // Custom pre-checks
            this.checkParam(paramdef.prechecks, param, paramname, reject, 'Pre-Check');
            // Custom formats
            param = this.formatParam(paramdef.formatters, param, paramname, reject);
            // Custom checks
            this.checkParam(paramdef.checks, param, paramname, reject, 'Check');
        }
        return param;
    }

    /**
     * Check can fail by using reject, or returning false.
     * @param {Function[]} checks 
     * @param {any} param 
     * @param {Function} reject 
     * @param {String} checktype
     */
    static checkParam(checks, param, paramname, reject, checktype = 'Check') {
        if (checks) {
            checks.forEach((check, index) => {
                if (check(param, paramname, reject, index) === false) {
                    reject(checktype + ' ' + index + ' failed for param "' + paramname + '"!');
                }
            });
        }
    }

    /**
     * Format can fail by using reject. 
     * Param is always altered to return value.
     * @param {Function[]} formatters 
     * @param {any} param 
     * @param {Function} reject 
     */
    static formatParam(formatters, param, paramname, reject) {
        if (formatters) {
            formatters.forEach((formatter, index) => {
                param = formatter(param, paramname, reject, index);
            });
        }
        return param;
    }

}
module.exports = Clearer;