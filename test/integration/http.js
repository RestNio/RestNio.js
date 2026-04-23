const should = require('should');
const { spinUp } = require('../helpers/server');
const { request } = require('../helpers/httpClient');

describe('HTTP routing (integration)', function() {
    /** @type {import('../helpers/server').SpawnedServer} */
    let server;

    afterEach(async () => {
        if (server) await server.close();
        server = null;
    });

    it('serves a plain GET returning a string', async () => {
        server = await spinUp((router) => {
            router.get('/', () => 'hello');
        });
        const res = await request('GET', `${server.url}/`);
        res.status.should.equal(200);
        res.body.should.equal('hello');
    });

    it('serves a JSON object response with content-type', async () => {
        server = await spinUp((router) => {
            router.get('/obj', () => ({ a: 1, b: 2 }));
        });
        const res = await request('GET', `${server.url}/obj`);
        res.status.should.equal(200);
        res.json.should.deepEqual({ a: 1, b: 2 });
        res.headers['content-type'].should.match(/json/);
    });

    it('validates typed query params', async () => {
        server = await spinUp((router) => {
            router.get('/strict', {
                params: {
                    age: { required: true, type: 'number' }
                },
                func: (params) => ({ gotAge: params.age })
            });
        });
        const ok = await request('GET', `${server.url}/strict?age=5`);
        ok.json.should.deepEqual({ gotAge: 5 });

        const bad = await request('GET', `${server.url}/strict`);
        bad.status.should.be.within(400, 499);
    });

    it('parses path parameters', async () => {
        server = await spinUp((router) => {
            router.get('/dog/:name', (params) => `name: ${params.name}`);
        });
        const res = await request('GET', `${server.url}/dog/rex`);
        res.body.should.equal('name: rex');
    });

    it('accepts JSON bodies on POST', async () => {
        server = await spinUp((router) => {
            router.post('/echo', (params) => params);
        });
        const res = await request('POST', `${server.url}/echo`, {
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ hello: 'world', n: 7 })
        });
        res.json.should.deepEqual({ hello: 'world', n: 7 });
    });

    it('returns 404 for unknown routes', async () => {
        server = await spinUp((router) => {
            router.get('/', () => 'ok');
        });
        const res = await request('GET', `${server.url}/nope`);
        res.status.should.equal(404);
    });

    it('sends raw bytes via client.bin() with octet-stream default', async () => {
        server = await spinUp((router) => {
            router.get('/blob', (params, client) => {
                client.bin(Buffer.from([0xde, 0xad, 0xbe, 0xef]));
                return Infinity;
            });
        });
        const res = await request('GET', `${server.url}/blob`);
        res.status.should.equal(200);
        res.headers['content-type'].should.equal('application/octet-stream');
        res.bodyBuffer.should.have.length(4);
        res.bodyBuffer.toString('hex').should.equal('deadbeef');
    });
});
