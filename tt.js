const restnio = require('./');

new restnio((router, rnio) => {
    router.get('/', () => {
        return 'HIII :D';
    });

    router.use('/baa', rnio.serve('./test/', {doListing: true, noFilename:true, cache: true}));

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