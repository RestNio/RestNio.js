const RestNio = require('./');

let dogSite = new RestNio((router, restnio) => {
    router.get('/', () => {
        return [...restnio.routes];
    });
    router.use(restnio.serve('./README.md'));
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