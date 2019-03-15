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
        let serve = (filepath, routename) => {
            fs.readFile(filepath, restnio.options.serve.encoding, (err, data) => {
                if(err) throw err;
                router.get(routename, () => data);
            });
        }
        if (stats.isFile) {
            serve(path, filePath(path));
        } else if (stats.isDirectory) {
            // TODO: folders? :D
            // Do it recursively.
        }
    });
};

//=====================================================\\
//				          Utils		          		   \\
//=====================================================\\

function filePath(path, dirpath = '') {
    return dirpath + path.substring(path.lastIndexOf('/'));
}