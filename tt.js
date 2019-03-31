const RestNio = require('./');

let dogSite = new RestNio((router, restnio) => {
    // router.get('/', () => {
    //     return [...restnio.routes];
    // });

    router.all('/$name/hi', (params) => {
        return `${params.name} is een aardig persoon.`;
    });

    router.get('/day/maandag', () => 'Dat is een leuke dag');
    router.get('/location/*/give', () => 'nu gaat ie mis');

    router.use('/derp', (router) => {
        router.get('/', () => 'derpindex');
        router.get('/name', () => 'kasper');
    }, true);

    router.redirect('/test', '/derp/name');

    // router.use(restnio.serve('./README.md'));
}, {port: 7070});
console.dir(dogSite.routes);
dogSite.bind();

// let options = {
//     port: 7070
// };
// let dogSite = new RestNio(router => {
//     router.get('/', () => 'hey :D');
// });
// console.log(dogSite.routes);
// dogSite.bind();