const restnio = require('./');
// new restnio((router) => {
//     router.get('/', (params, client) => client.request.headers);
// }, {}).bind();

new restnio((router, rnio) => {

    router.use('./test', )
}, {
    port: 7070,
    websocket: {
        motd: (params, client) => {

        }
    }
})

//new restnio(, {port: 7070});