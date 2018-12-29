const RestNio = require('./');
let security = {
    secret: 'dogshite',
    signOptions: {
        expiresIn: '1h'
    }
}
let dogSite = new RestNio(7070, require('./test/dogSite'), security);
console.log(dogSite.routes);
dogSite.bind();