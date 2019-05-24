const restnio = require('./');

new restnio((router, rnio) => {
    router.get('/', () => {
        return 'HIII :D';
    });

    router.get('/cookie', (params, client) => {
        
    });

    router.post('/nomnom/:extraparam', (params, client) => {
        return {headers: client.headers, cookies: client.cookies, params: params};
    });

}, {
    port: 7070,
    websocket: {
        motd: (params, client) => {
            
        }
    },
    default: {
        httpProperties: {
            jsonResponse: false,
            jsonError: false
        }
    }
}).bind();


/**
 * @type import("./").Router
 */
let routefunc = (router, restnio) => {
    
};