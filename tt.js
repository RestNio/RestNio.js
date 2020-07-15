const restnio = require('./');

let main = new restnio((router, rnio) => {
    router.get('/', () => {
        return 'HIII :D';
    });

    router.get('/ree/:dope', (params)=>params.dope);

    router.use('/baa', rnio.serve('./test/', {doListing: true, noFilename:true, cache: false, recursive: true}));

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
});
main.bind();
console.dir(main.routes);

/**
 * @type import("./").Router
 */
let routefunc = (router, restnio) => {
    
};