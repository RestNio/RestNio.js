/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

// Imports
const fs = require('fs');

/**
 * @class Serve
 * @classdesc
 * Serve static files 
 */
module.exports = (path) => (router, restnio) => {
    fs.lstat(path, (err, stats) => {
        if(err) throw err; // Tell them user.
        let serve = (filepath) => {
            fs.readFile(filepath, restnio.options.serve.encoding, (err, data) => {
                router.get('/hi', () => data);
            });
        }
        if (stats.isFile) {
            serve(path);
        } else if (stats.isDirectory) {
            // TODO: folders? :D
        }
    });
};