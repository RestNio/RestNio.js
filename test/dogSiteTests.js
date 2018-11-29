const should = require('should');
const RestNio = require('../');
describe('Dog Site Tests', function() {
    let dogSite = RestNio(8080, null, require('./dogSite'), 'dogsite.com');
    console.log(dogSite.routes);
    describe('Basic Route', function() {
        it('Simple root path.', function() {
            ''.should.equal('');
        });

    });
});