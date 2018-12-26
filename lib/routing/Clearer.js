/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

const permissionRegex = /\$([^.]+)/g;

class Clearer {

    /**
     * Verifies and sanitises all params.
     * @param {*[]} paramdefs 
     * @param {*[]} params 
     */
    static clearParams(paramdefs, params) {
        process.stdout.write('<-'); console.log(params); //TODO remove.
        return new Promise((resolve, reject) => {
            //Permissions

            //Checks
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
     * @param {*} paramdef 
     * @param {*} param 
     * @param {String} paramname 
     * @param {Function} reject 
     */
    static clearParam(paramdef, param, paramname, reject) {
        // Present check
        if (param === undefined) {
            if (paramdef.required) {
                reject('Missing param "' + paramname + '"!');
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

    static checkPermissions(permissions, params, client, reject) {
        permissions.forEach(permission => {
            let requiredPermission = permission.replace(permissionRegex, (match, paramname) => {
                return params[paramname];
            });
            if (!client.hasPerm(requiredPermission)) {
                //reject(noPERMSSIIS);
            }
        });
    }

    /**
     * Check can fail by using reject, or returning false.
     * @param {Function[]} checks 
     * @param {*} param 
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