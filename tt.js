const restnio = require('./');
const params = require('./lib/params');

let main = new restnio((router, rnio) => {
    router.get('/', () => {
        rnio.subs('test').str('hello');
        return 'HIII :D';
    });
    router.get('/whois', () => {
        //rnio.subs('test').add('test');
        console.dir(rnio.subs('test'));
        // rnio.subs('test').forEach(client => client.str('hi'));
        return Array.from(rnio.subs('test')).map(client => client.ip);
    });

    router.ws('/sub', (params, client) => {
        client.subscribe('test');
        return "subbed";
    });

    // router.use('/ree/:dope/', rnio.ratelimit({
    //     per: 'params', perParams: ['dope', 'dape']
    // }));
    // router.get('/ree/:dope', (params)=>params.dope);
    // router.get('/ree/:dope/dape', (params)=>params.dope + params.dape);

    // router.get('/drep', () => 'ddd');
    // router.use('/drep**', rnio.ratelimit({scope: "soft"}));
    // router.get('/drep**', () => 'eee');

    // router.get(':[i]/m..p', () => 'NICE :D');
    // router.get('/drep/*/test', () => '111');

    // router.use('/whatismyip', rnio.ratelimit({

    // }));
    // router.get('/whatismyip', (params, client) => client.ip);

	// //router.redirect('/docs', '/docs/');
    // router.use('/docs', rnio.serve('./docs/', {cache:false, doListing: true, noFilename:true}), true);

    // router.get('/cookie', (params, client) => {
        
    // });

    // router.post('/nomnom/:extraparam', (params, client) => {
    //     return {headers: client.headers, cookies: client.cookies, params: params};
    // });

}, {
    port: 7070,
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