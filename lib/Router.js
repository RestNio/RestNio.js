const rnio = require('./RestNio');
let routes = rnio.routes;

function route(method, path, params, permissions, func) {
    
}

function httpRoute(path, name, func) {
    httpRoutes[path] = {name: name, func: func};
}

function routeSpecific(fullpath, params, permissions, func) {
    
}