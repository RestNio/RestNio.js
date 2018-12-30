const should = require('should');
const Options = require('../../lib/util/Options');
describe('Options', () => {
    describe('When no options are specified, options', () => {
        it('should be exactly equal to the default options of RestNio.', () => {
            let options = undefined;
            options = Options.optionate(options);
            options.should.equal(Options.defaultOptions);
        });
    });
    describe('When just some options are specified, options', () => {
        it('should have the options, but still load other defaults.', () => {
            let options = {
                websocket: {
                    enabled: false
                }
            }
            options = Options.optionate(options);
            options.should.have.property('path').which.equals('/');
            options.should.have.property('websocket').which.should.have.property('enabled').which.equals(false);
            options.should.have.property('websocket').which.should.have.property('forceToken');
        });
    });
});