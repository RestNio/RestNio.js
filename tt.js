const RestNio = require('./');
let options = {
    port: 7070
};
let dogSite = new RestNio(router => {
    router.get('/', () => 'hey :D');
});
console.log(dogSite.routes);
dogSite.bind();