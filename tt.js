const restnio = require('./');
// new restnio((router) => {
//     router.get('/', (params, client) => client.request.headers);
// }, {}).bind();

new restnio((router, rnio) => {
    router.use('/test', (dmoet) => {
        dmoet.htt
    }, true);
}, {
    port: 7070,
    websocket: {
        motd: (params, client) => {

        }
    }
})

/**
 * @type import("./lib/routes/Router").RouteBack
 */
let routefunc = (router, restnio) => {
    
};

//new restnio(, {port: 7070});