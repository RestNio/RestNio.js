/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

class Verifier {

    static verifyParams(paramdefs, params) {
        console.log(params);
        return new Promise((resolve, reject) => {
            Object.keys(paramdefs).forEach(paramname => {
                console.log(paramname + '!');
                let paramdef = paramdefs[paramname];
                let param = params[paramname];
                if (param === undefined) {
                    if (paramdef.required) {
                        reject('Missing param ' + paramname + '!');
                    }
                } else {
                    //WIP
                }
            });
            resolve(params);
        });
    }

}
module.exports = Verifier;