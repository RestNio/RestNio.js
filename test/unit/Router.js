const should = require('should');
const RestNio = require('../../');

/**
 * Unit tests for Router's per-method helpers. We instantiate a RestNio
 * without binding to a port — just poking at the routes map it builds.
 */
describe('Router', () => {
    function build(routeFn) {
        return new RestNio(routeFn, {
            port: 0,
            auth: { enabled: false },
            websocket: { enabled: true },
            http: { enabled: true }
        });
    }

    function keysOf(rnio) {
        return Array.from(rnio.routes.keys()).map(r => r.toString());
    }

    it('httpGet / httpPost / httpPut / httpPatch / httpDelete / httpOptions / httpTrace each register a method-specific route', () => {
        const rnio = build((router) => {
            router.httpGet('/g', () => 'g');
            router.httpHead('/h', () => 'h');
            router.httpPost('/p', () => 'p');
            router.httpPut('/pu', () => 'pu');
            router.httpPatch('/pa', () => 'pa');
            router.httpDelete('/d', () => 'd');
            router.httpOptions('/o', () => 'o');
            router.httpTrace('/t', () => 't');
        });
        const keys = keysOf(rnio);
        keys.some(k => k.includes('GET') && k.includes('/g')).should.be.true();
        keys.some(k => k.includes('HEAD') && k.includes('/h')).should.be.true();
        keys.some(k => k.includes('POST') && k.includes('/p')).should.be.true();
        keys.some(k => k.includes('PUT') && k.includes('/pu')).should.be.true();
        keys.some(k => k.includes('PATCH') && k.includes('/pa')).should.be.true();
        keys.some(k => k.includes('DELETE') && k.includes('/d')).should.be.true();
        keys.some(k => k.includes('OPTIONS') && k.includes('/o')).should.be.true();
        keys.some(k => k.includes('TRACE') && k.includes('/t')).should.be.true();
    });

    it('head / post / put / patch / delete / options / trace (bimodal: http + ws) register both', () => {
        const rnio = build((router) => {
            router.head('/h', () => 'h');
            router.post('/p', () => 'p');
            router.put('/pu', () => 'pu');
            router.patch('/pa', () => 'pa');
            router.delete('/d', () => 'd');
            router.options('/o', () => 'o');
            router.trace('/t', () => 't');
        });
        // For each bimodal helper the baked regex must allow both HTTP:<METHOD> and WS.
        const keys = keysOf(rnio);
        for (const tag of ['HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'TRACE']) {
            keys.some(k => k.includes(tag) && k.includes('WS')).should.be.true();
        }
    });

    it('httpAll with method list restricts to those methods only', () => {
        const rnio = build((router) => {
            router.httpAll('/mixed', () => 'ok', {}, [], true, ['GET', 'POST']);
        });
        const key = keysOf(rnio).find(k => k.includes('/mixed'));
        key.should.match(/GET/);
        key.should.match(/POST/);
    });

    it('redirect() registers http redirect + ws message', () => {
        const rnio = build((router) => {
            router.redirect('/old', '/new');
        });
        keysOf(rnio).some(k => k.includes('/old')).should.be.true();
    });

    it('use() with a function-only arg stacks onto the current path', () => {
        const rnio = build((router) => {
            router.use((inner) => {
                inner.get('/stacked', () => 'ok');
            });
        });
        keysOf(rnio).some(k => k.includes('/stacked')).should.be.true();
    });

    it('use() with a non-function router throws', () => {
        let caught = null;
        try {
            build((router) => {
                router.use('/x', 'not-a-router');
            });
        } catch (e) { caught = e; }
        should(caught).not.be.null();
        String(caught).should.match(/Could not initialise/);
    });
});
