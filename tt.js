const RestNio = require('./');
let dogSite = new RestNio(7070, null, require('./test/dogSite'));
console.log(dogSite.routes);
dogSite.bind();