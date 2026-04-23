const should = require('should');
const RouteMap = require('../../lib/util/RouteMap');

describe('RouteMap', () => {
    describe('set() + get()', () => {
        it('stores and retrieves a route by plain string path', () => {
            const m = new RouteMap();
            m.set('/foo', { id: 1 });
            const hit = m.get('/foo');
            hit.routes.should.have.length(1);
            hit.routes[0].id.should.equal(1);
        });

        it('returns no routes for unknown paths', () => {
            const m = new RouteMap();
            m.set('/foo', { id: 1 });
            m.get('/bar').routes.should.have.length(0);
        });

        it('supports path parameters via :name syntax', () => {
            const m = new RouteMap();
            m.set('/dog/:name/feed', { id: 'feed' });
            const hit = m.get('/dog/rex/feed');
            hit.routes.should.have.length(1);
            hit.pathParams.name.should.equal('rex');
        });

        it('supports trailing-star wildcards', () => {
            const m = new RouteMap();
            m.set('/files/*', { id: 'files' });
            m.get('/files/a/b/c').routes.should.have.length(1);
        });

        describe('trailing globstar semantics', () => {
            // Asterisk patterns kept in the baked regex form `/.*` vs `(?:\/.*)?`.
            it('`/api/*` matches only paths UNDER /api/ (not /api itself)', () => {
                const m = new RouteMap();
                m.set('/api/*', { id: 'under' });
                m.get('/api/a').routes.should.have.length(1);
                m.get('/api/a/b').routes.should.have.length(1);
                m.get('/api/').routes.should.have.length(1);
                m.get('/api').routes.should.have.length(0);
            });

            it('`/api/**` matches only paths UNDER /api/ (not /api itself)', () => {
                const m = new RouteMap();
                m.set('/api/**', { id: 'under-star' });
                m.get('/api/a').routes.should.have.length(1);
                m.get('/api/a/b').routes.should.have.length(1);
                m.get('/api/').routes.should.have.length(1);
                m.get('/api').routes.should.have.length(0);
            });

            it('`/api**` matches BOTH /api itself AND everything under it', () => {
                const m = new RouteMap();
                m.set('/api**', { id: 'inclusive' });
                m.get('/api').routes.should.have.length(1);
                m.get('/api/').routes.should.have.length(1);
                m.get('/api/a').routes.should.have.length(1);
                m.get('/api/a/b').routes.should.have.length(1);
                m.get('/apikey').routes.should.have.length(0); // no false prefix match
            });
        });

        it('returns all matching routes when multiple regexes overlap', () => {
            const m = new RouteMap();
            m.set('/foo', { id: 1 });
            m.set('/foo', { id: 2 });
            const hit = m.get('/foo');
            hit.routes.should.have.length(2);
        });
    });

    describe('has()', () => {
        it('returns true for a matching string path', () => {
            const m = new RouteMap();
            m.set('/foo', {});
            m.has('/foo').should.be.true();
        });
        it('returns false for non-matching', () => {
            const m = new RouteMap();
            m.set('/foo', {});
            m.has('/bar').should.be.false();
        });
    });

    describe('delete()', () => {
        it('removes all regex entries matching a string path', () => {
            const m = new RouteMap();
            m.set('/foo', {});
            m.set('/foo', {}); // duplicate key (different regex object)
            m.delete('/foo').should.be.true();
            m.has('/foo').should.be.false();
        });
        it('returns false if nothing matched', () => {
            const m = new RouteMap();
            m.delete('/foo').should.be.false();
        });
    });

    describe('throws on unsupported path shapes', () => {
        // RouteMap throws raw strings (not Error objects), so we assert via try/catch.
        it('set() rejects non-string non-regex', () => {
            const m = new RouteMap();
            let caught = null;
            try { m.set(42, {}); } catch (e) { caught = e; }
            should(caught).not.be.null();
            String(caught).should.match(/Unsupported path/);
        });
        it('has() rejects non-string non-regex', () => {
            const m = new RouteMap();
            let caught = null;
            try { m.has(42); } catch (e) { caught = e; }
            should(caught).not.be.null();
            String(caught).should.match(/Unsupported path/);
        });
    });
});
