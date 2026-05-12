const should = require('should');
const SubscriptionMap = require('../../lib/util/SubscriptionMap');
const ClientSet = require('../../lib/util/ClientSet');

/**
 * Unit tests for SubscriptionMap. Covers both the Map surface (Set
 * lazy-creation per channel, member tracking) and the lifecycle event
 * emitter (subscribe / unsubscribe / first / empty).
 */
describe('SubscriptionMap', () => {

    /** Minimal Client stub — only identity matters for sub bookkeeping. */
    function stubClient(tag = '') {
        return { _tag: tag };
    }

    // ---------------------------------------------------------------
    // Map surface
    // ---------------------------------------------------------------

    it('lazy-creates a ClientSet on first get(name)', () => {
        const sm = new SubscriptionMap();
        const set = sm.get('news');
        set.should.be.instanceOf(ClientSet);
        set.name.should.equal('news');
        // Re-fetching returns the same instance.
        sm.get('news').should.equal(set);
    });

    it('adds clients on subscribe and removes on unsubscribe', () => {
        const sm = new SubscriptionMap();
        const a = stubClient('a');
        const b = stubClient('b');
        sm.subscribe('news', a);
        sm.subscribe('news', b);
        sm.get('news').size.should.equal(2);
        sm.unsubscribe('news', a);
        sm.get('news').size.should.equal(1);
        sm.get('news').has(b).should.be.true();
    });

    // ---------------------------------------------------------------
    // Lifecycle events
    // ---------------------------------------------------------------

    it('fires `subscribe` on every add', () => {
        const sm = new SubscriptionMap();
        const seen = [];
        sm.on('subscribe', (name, size, client) => seen.push([name, size, client._tag]));
        sm.subscribe('news', stubClient('a'));
        sm.subscribe('news', stubClient('b'));
        seen.should.deepEqual([
            ['news', 1, 'a'],
            ['news', 2, 'b'],
        ]);
    });

    it('fires `unsubscribe` on every remove', () => {
        const sm = new SubscriptionMap();
        const a = stubClient('a');
        const b = stubClient('b');
        sm.subscribe('news', a);
        sm.subscribe('news', b);
        const seen = [];
        sm.on('unsubscribe', (name, size, client) => seen.push([name, size, client._tag]));
        sm.unsubscribe('news', b);
        sm.unsubscribe('news', a);
        seen.should.deepEqual([
            ['news', 1, 'b'],
            ['news', 0, 'a'],
        ]);
    });

    it('fires `first` only on 0 → 1 transitions', () => {
        const sm = new SubscriptionMap();
        const seen = [];
        sm.on('first', (name, client) => seen.push([name, client._tag]));
        const a = stubClient('a');
        const b = stubClient('b');
        sm.subscribe('news', a);     // first
        sm.subscribe('news', b);     // not first
        sm.unsubscribe('news', a);
        sm.unsubscribe('news', b);
        sm.subscribe('news', a);     // first again after empty
        seen.should.deepEqual([
            ['news', 'a'],
            ['news', 'a'],
        ]);
    });

    it('fires `empty` only on n → 0 transitions', () => {
        const sm = new SubscriptionMap();
        const seen = [];
        sm.on('empty', name => seen.push(name));
        const a = stubClient('a');
        const b = stubClient('b');
        sm.subscribe('news', a);
        sm.subscribe('news', b);
        sm.unsubscribe('news', a);   // not empty yet
        sm.unsubscribe('news', b);   // empty
        seen.should.deepEqual(['news']);
    });

    it('does not fire on idempotent subscribe (same client twice)', () => {
        const sm = new SubscriptionMap();
        const fires = { subscribe: 0, first: 0 };
        sm.on('subscribe', () => fires.subscribe++);
        sm.on('first',     () => fires.first++);
        const a = stubClient('a');
        sm.subscribe('news', a);
        sm.subscribe('news', a);   // already a member — no event
        fires.subscribe.should.equal(1);
        fires.first.should.equal(1);
    });

    it('does not fire on idempotent unsubscribe (non-member)', () => {
        const sm = new SubscriptionMap();
        const fires = { unsubscribe: 0, empty: 0 };
        sm.on('unsubscribe', () => fires.unsubscribe++);
        sm.on('empty',       () => fires.empty++);
        sm.unsubscribe('news', stubClient('a'));
        fires.unsubscribe.should.equal(0);
        fires.empty.should.equal(0);
    });

    it('isolates events per channel name', () => {
        const sm = new SubscriptionMap();
        const seen = [];
        sm.on('first', (name) => seen.push(['first', name]));
        sm.on('empty', (name) => seen.push(['empty', name]));
        const a = stubClient('a');
        const b = stubClient('b');
        sm.subscribe('alpha', a);
        sm.subscribe('beta',  b);
        sm.unsubscribe('alpha', a);
        seen.should.deepEqual([
            ['first', 'alpha'],
            ['first', 'beta'],
            ['empty', 'alpha'],
        ]);
    });

    it('once() handler fires exactly once', () => {
        const sm = new SubscriptionMap();
        let fires = 0;
        sm.once('subscribe', () => fires++);
        const a = stubClient('a');
        sm.subscribe('news', a);
        sm.subscribe('news', stubClient('b'));
        fires.should.equal(1);
    });

    it('off() removes a previously-registered listener', () => {
        const sm = new SubscriptionMap();
        let fires = 0;
        const fn = () => fires++;
        sm.on('subscribe', fn);
        sm.subscribe('news', stubClient('a'));
        sm.off('subscribe', fn);
        sm.subscribe('news', stubClient('b'));
        fires.should.equal(1);
    });
});
