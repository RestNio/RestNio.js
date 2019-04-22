/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

// Imports
const fs = require('fs');
const mime = require('mime-types');

/**
 * @class Serve
 * @classdesc
 * Serve static files.
 * When cache = true files are all readed in on startup
 * and served from the javascript object cache.
 * When cache = false files are read upon request.
 * 
 * TODO: Change behaviour and following text!
 * _Please note that the structure is not cached,
 * new or removed files will not be updated even with cache = false
 * If you are looking to host dynamic resources checkout
 * the 'dserve' plugin. (WIP)_
 */
module.exports = (path, cache = true) => (router) => {

    // TODO generate index pages?
    // TODO More intuative path handling?

    /**
     * Gets the last part of a pathname,
     * but prepend it with optional directory.
     * @param {string} path - the path to get last part of.
     * @param {string} [dirpath] - the optional directory to prepend the path with
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
        if (cache) { // For cached serving just read and save everything.
            let stats = fs.statSync(filepath);
            if (stats.isFile()) {
                let routename = lastpath(filepath, dirpath);
                let file = fs.readFileSync(filepath);
                let contentType = mime.lookup(filepath);
                router.get(routename, (params, client) => {
                    client.header('content-type', contentType);
                    return file;
                });
            } else if (stats.isDirectory()) {
                let files = fs.readdirSync(filepath);
                for (let file of files) {
                    serve(`${filepath}/${file}`, lastpath(filepath, dirpath));
                }
            } else {
                throw 'Unsupported path!';
            }
        } else { // For non-cached serving add an async read function to be executed en route.
            router.get('/*', (params, client) => new Promise((resolve, reject) => { // Route 
                console.log('GOING FOR: ' + lastpath(client.lastpath.replace(router.path, ''), dirpath));
                fs.readFile(lastpath(client.lastpath.replace(router.path, ''), dirpath), (err, data) => {
                    if (err) reject(err);
                    // if (client.type === 'http') {
                    //     client.header('content-type', mime.lookup(filepath));
                    //     var s = fs.createReadStream(filepath);
                    //     console.dir(s);
                    //     s.on('open', function () {
                    //         s.pipe(client.response);
                    //     });
                    //     resolve(Infinity); //Pipe through non cached.
                    // } else {
                        resolve(data); //Just pipe through data buffer.
                    // }
                });
            }));
            router.redirect(filepath, `${filepath}/`); // Special redirect for serving single files.

            router.get(routename, (params, client) => new Promise((resolve, reject) => {
                fs.readFile(filepath, (err, data) => {
                    if (err) reject(err);
                    if (client.type === 'http') {
                        client.header('content-type', mime.lookup(filepath));
                        var s = fs.createReadStream(filepath);
                        console.dir(s);
                        s.on('open', function () {
                            s.pipe(client.response);
                        });
                        return Infinity; //Pipe through non cached.
                    } else {
                        return data;
                    }
                });
            }));
        }
    }

    // Initialise recursive serving on specified path.
    serve(path);

};