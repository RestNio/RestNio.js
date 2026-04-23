const should = require('should');
const fs = require('fs');
const os = require('os');
const path = require('path');
const RestNio = require('../../');
const { spinUp } = require('../helpers/server');
const { request } = require('../helpers/httpClient');

/**
 * Creates a throwaway temp directory populated with fixture files for
 * serve-plugin tests. Tests call `cleanup()` in afterEach.
 */
function makeFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'restnio-serve-'));
    fs.writeFileSync(path.join(root, 'hello.txt'), 'hello world');
    fs.writeFileSync(path.join(root, 'data.json'), JSON.stringify({ ok: true }));
    fs.mkdirSync(path.join(root, 'sub'));
    fs.writeFileSync(path.join(root, 'sub', 'inner.txt'), 'inner');
    fs.mkdirSync(path.join(root, 'withindex'));
    fs.writeFileSync(path.join(root, 'withindex', 'index.html'), '<h1>root index</h1>');
    return {
        root,
        cleanup() { fs.rmSync(root, { recursive: true, force: true }); }
    };
}

describe('serve plugin (integration)', function() {
    /** @type {import('../helpers/server').SpawnedServer} */
    let server;
    /** @type {{ root: string, cleanup: () => void }} */
    let fixture;

    beforeEach(() => { fixture = makeFixture(); });
    afterEach(async () => {
        if (server) await server.close();
        server = null;
        if (fixture) fixture.cleanup();
        fixture = null;
    });

    it('serves a single file at the mount path (noFilename default)', async () => {
        server = await spinUp((router) => {
            router.use('/page', RestNio.serve(path.join(fixture.root, 'hello.txt')));
        });
        const res = await request('GET', `${server.url}/page`);
        res.status.should.equal(200);
        res.body.should.equal('hello world');
    });

    it('serves a directory recursively with correct mime types', async () => {
        server = await spinUp((router) => {
            router.use('/files', RestNio.serve(fixture.root + '/'));
        });
        const txt = await request('GET', `${server.url}/files/hello.txt`);
        txt.status.should.equal(200);
        txt.body.should.equal('hello world');
        txt.headers['content-type'].should.match(/text\/plain/);

        const json = await request('GET', `${server.url}/files/data.json`);
        json.json.should.deepEqual({ ok: true });
        json.headers['content-type'].should.match(/json/);

        const nested = await request('GET', `${server.url}/files/sub/inner.txt`);
        nested.body.should.equal('inner');
    });

    it('404s on missing files', async () => {
        server = await spinUp((router) => {
            router.use('/files', RestNio.serve(fixture.root + '/'));
        });
        const res = await request('GET', `${server.url}/files/nope.txt`);
        res.status.should.equal(404);
    });

    it('serves index.html when present on a directory path', async () => {
        server = await spinUp((router) => {
            router.use('/static', RestNio.serve(fixture.root + '/'));
        });
        const res = await request('GET', `${server.url}/static/withindex/`);
        res.status.should.equal(200);
        res.body.should.match(/root index/);
    });

    it('returns a generated listing when doListing=true and no index present', async () => {
        fs.unlinkSync(path.join(fixture.root, 'withindex', 'index.html'));
        server = await spinUp((router) => {
            router.use('/static', RestNio.serve(fixture.root + '/', { doListing: true }));
        });
        const res = await request('GET', `${server.url}/static/withindex/`);
        res.status.should.equal(200);
        res.body.should.match(/Index of/);
    });

    it('with cache=true pre-reads files and still serves correctly', async () => {
        server = await spinUp((router) => {
            router.use('/cached', RestNio.serve(fixture.root + '/', { cache: true, doListing: true }));
        });
        const res = await request('GET', `${server.url}/cached/hello.txt`);
        res.status.should.equal(200);
        res.body.should.equal('hello world');
    });

    it('with cache=true serves a single file with correct content-type', async () => {
        server = await spinUp((router) => {
            router.use('/only', RestNio.serve(path.join(fixture.root, 'data.json'), { cache: true }));
        });
        const res = await request('GET', `${server.url}/only`);
        res.json.should.deepEqual({ ok: true });
        res.headers['content-type'].should.match(/json/);
    });

    it('recursive=false only serves one level', async () => {
        server = await spinUp((router) => {
            router.use('/shallow', RestNio.serve(fixture.root + '/', { recursive: false }));
        });
        const top = await request('GET', `${server.url}/shallow/hello.txt`);
        top.status.should.equal(200);
        // Deep path should not resolve because recursive routing wasn't wired.
        const deep = await request('GET', `${server.url}/shallow/sub/inner.txt`);
        deep.status.should.equal(404);
    });
});
