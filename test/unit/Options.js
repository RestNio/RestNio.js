const should = require('should');
const _ = require('lodash');
const Options = require('../../lib/util/Options');

/**
 * The Options module exports the default-options object directly.
 * RestNio consumes user options via `_.defaultsDeep(user || {}, Options)`,
 * so these tests verify that exact behavior.
 */
describe('Options', () => {
    describe('When no options are specified', () => {
        it('should deep-equal the default options module.', () => {
            const merged = _.defaultsDeep(undefined || {}, Options);
            merged.should.deepEqual(Options);
        });
    });
    describe('When only some options are specified', () => {
        it('should apply the user overrides but keep all other defaults.', () => {
            const merged = _.defaultsDeep({
                websocket: {
                    enabled: false
                }
            }, Options);
            merged.should.have.property('path').which.equals(Options.path);
            merged.should.have.property('port').which.equals(Options.port);
            merged.websocket.should.have.property('enabled').which.equals(false);
            merged.websocket.should.have.property('timeout').which.equals(Options.websocket.timeout);
            merged.should.have.property('auth').which.have.property('enabled').which.equals(Options.auth.enabled);
        });
    });
});
