/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

// Imports
const _ = require('lodash');
const fs = require('fs');
const mime = require('mime-types');
const stream = require('stream');
const util = require('util');

// Promisify fs
const fsExists = util.promisify(fs.exists);
const fsStat = util.promisify(fs.stat);
const fsReadDir = util.promisify(fs.readdir);
const fsIsFile = async function(path) { return await fsExists(path) && (await fsStat(path)).isFile() };
const fsIsDir = async function(path) { return await fsExists(path) && (await fsStat(path)).isDirectory() };

// Const
let fileex = /\.\w+$/; // RegExp to test for possible non-trailing-slash directories.

// Default options:
const defaults = {
    cache: false,
    index: 'index.html',
    maxBufferLength: 2**10, //1kb
    recursive: true,
    doListing: false
}

/**
 * @class Serve
 * @classdesc
 * Serves files from filesystem as restnio routes.
 * 
 * @param {string} path - The path to serve.
 * The path can be either relative (./) or absolute.
 * It can end in a trailing slash (/) to recursively serve
 * an entire folder, or point to a single file.
 */
module.exports = (path, options) => (router) => {
    options = _.defaultsDeep(options, defaults);

    /**
     * Saves a file to the user's routes.
     * @param {string} filepath the file path to (recursively) serve
     * @param {string} dirpath the directory path from the specified point onward.
     * The dirpath is a somewhat weird concept, but it basically keeps reference
     * to the path in the final url up to the actual to-be-served file.
     * The argument is automatically filled using recursion.
     */
    function serve(filepath, dirpath = '') {

        // For cached serving just read and save everything.
        if (options.cache) {
            let stats = fs.statSync(filepath);
            if (stats.isFile()) {
                let reqpath = lastpath(filepath, dirpath);
                syncDoFile(filepath, reqpath);
            } else if (stats.isDirectory()) {
                // We first need to find out the nesting path.
                // The nesting path is going to be the new dirpath and is
                // constructed from the recursively found nested folder,
                // starting after the root directory.
                let nestpath = '';
                if (filepath.endsWith('/')) {
                    // If we have a trailing slash we are in the first directory,
                    // which is the one we want to serve. So in this first case we do not
                    // want a nesting dirpath yet. (nestpath stays '')
                    filepath = filepath.slice(0, -1);
                } else {
                    // If we don't have a trailing slash we are going through a 'real' subfolder.
                    // If we don't want a recursive search, return before serving next dir.
                    if (!options.recursive) return;
                    // In this case we want the url to go deeper as well.
                    nestpath = lastpath(filepath, dirpath);
                }
                // Cycle through all files in the directory and recursively serve them.
                let files = fs.readdirSync(filepath);
                for (let file of files) {
                    serve(`${filepath}/${file}`, nestpath);
                }
                // Create an index for the directory.
                syncDoIndex(filepath, nestpath, files);
            } else {
                throw 'Unsupported path!';
            }
        } 

        // For non-cached serving add an async read function to be executed en route.
        else {
            // If a single file is specified to be served.
            if (!filepath.endsWith('/')) {
                router.get(lastpath(filepath, dirpath), (params, client) => {
                    return asyncServeFile(filepath, client);
                });
            }
            // If the specifed path is a directory 
            else {
                // When recursive is enabled we just lazily route all sub paths.
                if (options.recursive) {
                    router.get('/*', (params, client) => {
                        // Strip all path stuff off to get the full relative url path.
                        let reqpath = client.lastroute.replace(new RegExp(`.*\\:${router.path}`), '');
                        if (!reqpath.endsWith('/') && reqpath !== '') { //normal file
                            return asyncDoFile(filepath, reqpath, client);
                        } else { // INDEX Page
                            return asyncDoIndex(filepath, reqpath, client);
                        }
                    });
                }
                // Otherwise we take the last path part as path-parameter and go from there. 
                else {
                    router.get('/$reqpath', (params, client) => {
                        if (params.reqpath) { // check if there is a reqpath
                            return asyncDoFile(filepath, params.reqpath, client, true);
                        } else { // empty string -> route index
                            return asyncDoIndex(filepath, params.reqpath + '/', client);
                        }
                    });
                }
            }
        }

    }

    /**
     * Gets the last part of a pathname,
     * but prepend it with optional directory.
     * @param {string} path - the path to get last part of.
     * @param {string} [dirpath] - the optional directory to prepend the path with
     * @returns the part of the path after the last /, prepended with given dirpath.
     */
    function lastpath(path, dirpath = '') {
        return dirpath + '/' + path.substring(path.lastIndexOf('/') + 1);
    }

    /**
     * Gets the first part of a pathname.
     * This method is kind of the opposide to `lastpath()`.
     * The first part of the path is considered everything up to the
     * last word (cut off by slash), but excluding a possible 
     * trailing slash at the end.
     * @param {string} path
     * @returns the part of the path upto the last /, exluding a possible trailing /. 
     */
    function firstpath(path) {
        path = path.replace(/\/$/, ''); // Remove possible trailing slash.
        path = path.slice(0, path.lastIndexOf('/') + 1);
        return path;
    }

    /**
     * Serves a file in sync. This method is only used when caching
     * is activated and basically stalls the program on startup to
     * read and cache files in order. After the file is fully in memory
     * a route function is registered that either pipes or straight up
     * serves the read file.
     * @param {string} filepath - the machine path of the file.
     * @param {string} reqpath - the request path, to be registered for serving.
     */
    function syncDoFile(filepath, reqpath) {
        // Read file in, (in sync) and store the buffer in memory.
        let file = fs.readFileSync(filepath);
        let contentType = mime.lookup(filepath);
        if (file.byteLength > options.maxBufferLength) {
            // Upon request of large file and when the client is normal http
            // use a passthrough to stream from memory in chunks to the client.
            router.httpGet(reqpath, (params, client) => {
                client.header('content-type', contentType);
                let filestream = new stream.PassThrough();
                filestream.end(file);
                filestream.pipe(client.response);
                return Infinity;
            });
            // Websockets just get the buffer (for now)
            router.ws(reqpath, () => file);
        } else {
            // Otherwise just pipe through the entire (small) buffer.
            router.get(reqpath, (params, client) => {
                client.header('content-type', contentType);
                return file;
            });
        }
    }

    /**
     * Serves a folder index in sync. This method is only used when caching
     * is activated and basically stalls the program on startup to
     * read and cache the index. After the index is fully compiled
     * a route function is registered that straight up
     * serves the read file.
     * @param {string} filepath - the machine path of the folder.
     * @param {string} reqpath - the request path, to be registered for serving.
     * @param {string[]} files - a list of files in the directory
     */
    function syncDoIndex(filepath, reqpath, files) {
        // Serve Index page
        let indexPath = `${reqpath}/`;
        let indexFile = `${filepath}/${options.index}`;
        if (!!options.index && fs.existsSync(indexFile)) {
            // If a default index file is in the system, serve that.
            syncDoFile(indexFile, indexPath);
        } else if (options.doListing) {
            // Otherwise create and serve a custom index page.
            let indexPage = createIndex(router.path + indexPath, files);
            router.get(indexPath, () => indexPage);
        }
        // Add redirects to support non trailing slashes in browsers.
        if (router.path + reqpath !== '') router.redirect(reqpath, router.path + indexPath);
    }

    /**
     * Pipes a file async / lazily.
     * Instead of creating a route this function is called inside a route
     * and pipes the response to the client while its being read.
     * @param {string} filepath - the machine path of the file.
     * @param {Client} client - the client to pipe to.
     * @returns Infinity, as the responses are handled using events / callback.
     */
    function asyncServeFile(filepath, client) {
        // If we are http we can pipe the filestream directly to the client.
        if (client.type === 'http') {
            client.header('content-type', mime.lookup(filepath));
            var s = fs.createReadStream(filepath);
            s.on('open', function () {
                s.pipe(client.response);
            });
            s.on('error', (err) => {
                client.err(err, 500);
            });
            return Infinity; //Pipe through non cached.
        } 
        // If we are not http, read the file async and push the data when done.
        else {
            // TODO Check / improve this.
            fs.readFile(filepath, (err, data) => {
                if (err) client.err(err, 500);
                client.obj(data);
            });
            return Infinity;
        }
    }

    /**
     * Serves a folder index async. Instead of before routing,
     * this function is run inside a route, whenever the specified path
     * is likely to be a folder.
     * @param {string} filepath - the machine path of the folder.
     * @param {string} reqpath - the requested path from the routepath
     * @param {Client} client - the client to pipe to.
     * @returns Infinity (when serving file) or a string containing the index page.
     * @throws 404, if no index can or wants to be created.
     */
    async function asyncDoIndex(filepath, reqpath, client) {
        // If wanted, try serving the default index directly first.
        if (!!options.index && await fsExists(filepath + reqpath + options.index)) {
            return asyncServeFile(filepath + reqpath + options.index, client);
        // Otherwise create a custom index listing.
        } else if (options.doListing && await fsIsDir(filepath + reqpath)) {
            return createIndex(`${router.path}${reqpath}`, await fsReadDir(filepath + reqpath));
        // If not possible / wanted, just show a 404
        } else {
            throw [404, 'File / directory not found!'];
        }
    }

    /**
     * Serves a file async / lazily.
     * Instead of creating a route this function is called inside a route
     * and pipes the response to the client while its being read.
     * This function executes, but differs from `asyncServeFile()` in that it first
     * checks if the file exists and serves possible non-trailing-slash
     * directory urls following `asyncDoIndex()`.
     * @param {string} filepath - the machine path of the file.
     * @param {string} reqpath - the requested path from the routepath
     * @param {Client} client - the client to pipe to.
     * @param {boolean} [stopIndex] - override to stop serving nested index files!
     * @returns Infinity (when piping file), or a direct string response.
     * @throws 404, if no file / index was found at matching reqpath.
     */
    async function asyncDoFile(filepath, reqpath, client, stopIndex = false) {
        // If we find the file, just pipe it through.
        if (await fsIsFile(filepath + reqpath)) {
            return asyncServeFile(filepath + reqpath, client);
        // Otherwise check if it might be a directory and if we want to its index.
        } else if (!fileex.test(filepath + reqpath) && !stopIndex) {
            return asyncDoIndex(filepath, reqpath + '/', client);
        // Otherwise just 404 outta here.
        } else {
            throw [404, 'File not found!'];
        }
    }

    /**
     * Compiles a html index page listing all specified
     * files at a certain given path.
     * Note that the path is also used to generate relative
     * urls, and should be the same as `reqpath`, the actual route path.
     * @param {string} path - the title path
     * @param {string[]} files - the files
     * @returns the compiled html index page.
     */
    function createIndex(path, files) {
        return `<!DOCTYPE HTML>
        <html>
            <head>
                <title>Index of ${path}</title>
            </head>
            <body>
                <h1>Index of ${path}</h1>
                <table><tbody>
                    <tr><th>Name</th></tr>
                    <tr><th><hr></th></tr>
                    ${path !== '/' ? `<tr><td><a href="${firstpath(path)}">Parent Directory</a></td></tr>` : ''}
                    ${files.reduce((prev, file) => {
                        return prev += `<tr><td><a href="${path}${file}">${file}</a></td></tr>\n`;
                    }, '')}
                    <tr><th><hr></th></tr>
                </tbody></table>
                <address>RESTNIO Server</address>
            </body>
        </html>`;
    }

    // Initialise recursive serving on the specified path.
    serve(path);

};