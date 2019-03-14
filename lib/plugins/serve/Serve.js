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
 * Serve static files.
 * When cache = true files are all readed in on startup
 * and served from the javascript object cache.
 * When cache = false files are read upon request.
 * _Please note that the structure is not cached,
 * new or removed files will not be updated even with cache = false
 * If you are looking to host dynamic resources checkout
 * the 'dserve' plugin. (WIP)_
 */
module.exports = (path, cache = true) => (router, restnio) => {
    let encoding = restnio.options.serve.encoding;
    console.log(encoding)

    /**
     * Gets the last part of a pathname,
     * but prepend it with optional directory.
     * @param {*} path - the path to get last part of.
     * @param {*} [dirpath] - the optional directory to prepend the path with
     * @returns the part of the path after the last /, prepended with given dirpath.
     */
    function lastpath(path, dirpath) {
        return dirpath + '/' + path.substring(path.lastIndexOf('/') + 1);
    }

    /**
     * Saves a file to the user's routes.
     * @param {*} filepath 
     * @param {*} routename 
     */
    function serve(filepath, dirpath = '') {
        fs.stat(filepath, (err, stats) => {
            if (err) throw err;
            if (stats.isFile()) {
                let routename = lastpath(filepath, dirpath);
                 // TODO set mime type, and charset properly!
                if (cache) {
                    fs.readFile(filepath, encoding, (err, data) => {
                        if (err) throw err;
                        router.get(routename, () => data);
                    });
                } else {
                    router.get(routename, () => new Promise((resolve, reject) => {
                        fs.readFile(filepath, encoding, (err, data) => {
                            if (err) reject(err);
                            resolve(data);
                        });
                    }));
                }
            } else if (stats.isDirectory()) {
                fs.readdir(filepath, (err, files) => {
                    if (err) throw err;
                    for (let file of files) {
                        serve(`${filepath}/${file}`, lastpath(filepath, dirpath));
                    }
                });
            } else {
                throw 'Unsupported path!';
            }
        });
    }

    serve(path);
};