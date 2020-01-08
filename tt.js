const restnio = require('./');

new restnio((router, rnio) => {
    router.get('/', () => {
        return 'HIII :D';
    });

    router.use('/baa', rnio.serve('./LICENSE', {noFilename: true, cache: false}));

    router.get('/cookie', (params, client) => {
        
    });

    router.post('/nomnom/:extraparam', (params, client) => {
        return {headers: client.headers, cookies: client.cookies, params: params};
    });

}, {
    port: 80,
    websocket: {
        motd: (params, client) => 'Dope'
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