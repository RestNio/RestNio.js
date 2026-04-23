const should = require('should');
const ClientSet = require('../../lib/util/ClientSet');

/**
 * Unit tests for the ClientSet broadcast helpers. Covers the safe, used
 * methods. `header()` and `cookie()` contain pre-existing bugs (reference
 * an undefined `client` identifier / recurse infinitely) and are deliberately
 * skipped here — exercising them would crash and the fix is out of scope.
 */
describe('ClientSet', () => {
    /** Minimal stub Client that records calls. */
    function stub() {
        return {
            calls: [],
            ok() { this.calls.push(['ok']); },
            obj(o) { this.calls.push(['obj', o]); },
            json(...a) { this.calls.push(['json', a]); },
            str(s) { this.calls.push(['str', s]); },
            buf(b) { this.calls.push(['buf', b]); },
            err(e, c) { this.calls.push(['err', e, c]); },
            close() { this.calls.push(['close']); }
        };
    }

    it('is a Set — supports add/size/iteration', () => {
        const set = new ClientSet();
        const a = stub(); const b = stub();
        set.add(a); set.add(b);
        set.size.should.equal(2);
        Array.from(set).should.have.length(2);
    });

    it('forwards ok() to every client', () => {
        const set = new ClientSet();
        const a = stub(); const b = stub();
        set.add(a); set.add(b);
        set.ok();
        a.calls.should.containDeep([['ok']]);
        b.calls.should.containDeep([['ok']]);
    });

    it('forwards obj() / str() / buf() / json() / close()', () => {
        const set = new ClientSet();
        const c = stub();
        set.add(c);
        const buf = Buffer.from([1, 2, 3]);
        set.obj({ a: 1 });
        set.str('hi');
        set.buf(buf);
        set.json(1, 2);
        set.close();
        c.calls.should.containDeep([
            ['obj', { a: 1 }],
            ['str', 'hi'],
            ['buf', buf],
            ['json', [1, 2]],
            ['close']
        ]);
    });

    it('forwards err() with code', () => {
        const set = new ClientSet();
        const c = stub();
        set.add(c);
        set.err('oh no', 500);
        c.calls.should.containDeep([['err', 'oh no', 500]]);
    });

    it('throwErr splits [code, message] arrays into err(msg, code)', () => {
        const set = new ClientSet();
        const c = stub();
        set.add(c);
        set.throwErr([418, 'teapot']);
        c.calls.should.containDeep([['err', 'teapot', 418]]);
    });

    it('throwErr on a plain value sends it through err()', () => {
        const set = new ClientSet();
        const c = stub();
        set.add(c);
        set.throwErr('bad');
        c.calls.some(call => call[0] === 'err' && call[1] === 'bad').should.be.true();
    });
});
