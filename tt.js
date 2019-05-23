const restnio = require('./');

new restnio((router, rnio) => {
    rnio.$p
    router.get('/', () => {
        return 'HIII :D';
    });

}, {
    port: 7070,
    websocket: {
        motd: (params, client) => {

        }
    }
}).bind();


/**
 * @type import("./").Router
 */
let routefunc = (router, restnio) => {
    
};