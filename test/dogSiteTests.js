const should = require('should');
const RestNio = require('../');
describe('Dog Site Tests', function() {
    let dogSite = new RestNio(8080, require('./dogSite'));
    console.log(dogSite.routes);
    dogSite.bind();
    console.log('When does this get executed?');
    describe('Basic Route', function() {
        it('Simple root path.', function() {
            ''.should.equal('');
        });

    });
});