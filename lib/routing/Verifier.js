/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

class Verifier {

    static verifyParams(paramdefs, params) {
        process.stdout.write('<-'); console.log(params);
        return new Promise((resolve, reject) => {
            Object.keys(paramdefs).forEach(paramname => {
                let paramdef = paramdefs[paramname];
                let param = params[paramname];
                this.verifyParam(paramdef, param, paramname, reject);
            });
            resolve(params);
        });
    }

    static verifyParam(paramdef, param, paramname, reject) {
        // Present check
        if (param === undefined) {
            if (paramdef.required) {
                reject('Missing param "' + paramname + '"!');
            }
        } else {
            // Type check.
            if (paramdef.type !== undefined && typeof param !== paramdef.type) {
                reject('Incorrect param type: ' + typeof param + ', "' + paramname + '" should be ' + paramdef.type + '!')
            }
            // Custom check.
            if (paramdef.checks) {
                paramdef.checks.forEach((check, index) => {
                    // Check can fail by using reject, or returning false.
                    if (check(param, reject) === false) {
                        reject('Check ' + index + ' failed for param "' + paramname + '"!');
                    }
                });
            }
        }
    }

}
module.exports = Verifier;