const should = require('should');
const Route = require('../../lib/routes/Route');

describe('Route', () => {
    it('accepts a plain function (RouteFunc) and defaults the rest', () => {
        const fn = () => 'ok';
        const r = new Route(fn);
        r.func.should.equal(fn);
        r.params.should.deepEqual({});
        r.permissions.should.deepEqual([]);
        r.isActive.should.be.true();
    });

    it('accepts a full RouteDef object', () => {
        const fn = () => 'ok';
        const r = new Route({
            func: fn,
            params: { name: { required: true } },
            permissions: ['dog.feed'],
            isActive: false
        });
        r.func.should.equal(fn);
        r.params.should.have.property('name');
        r.permissions.should.deepEqual(['dog.feed']);
        r.isActive.should.be.false();
    });

    it('accepts spread-style constructor args', () => {
        const fn = () => 'ok';
        const r = new Route(fn, { age: { type: 'number' } }, ['dog.claim'], true);
        r.func.should.equal(fn);
        r.params.should.have.property('age');
        r.permissions.should.deepEqual(['dog.claim']);
    });

    it('treats isActive=false as explicitly set even when defaults would be true', () => {
        const r = new Route({ func: () => {}, isActive: false });
        r.isActive.should.be.false();
    });
});
