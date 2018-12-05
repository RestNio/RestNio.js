const RestNio = require('./');
let dogSite = new RestNio(8080, null, require('./test/dogSite'));
console.log(dogSite.routes);
dogSite.bind();