const should = require('should');
const params = require('../../lib/params');
const numChecks = require('../../lib/params/checks/Num');
const strChecks = require('../../lib/params/checks/Str');
const numFmt = require('../../lib/params/formatters/Num');
const strFmt = require('../../lib/params/formatters/Str');

describe('params: checks.num', () => {
    it('isInteger accepts integers, rejects floats', () => {
        const check = numChecks.isInteger();
        check(5).should.be.true();
        check(-3).should.be.true();
        check(1.5).should.be.false();
    });
    it('max rejects values above threshold', () => {
        const check = numChecks.max(10);
        check(10).should.be.true();
        check(11).should.be.false();
    });
    it('min rejects values below threshold', () => {
        const check = numChecks.min(0);
        check(0).should.be.true();
        check(-1).should.be.false();
    });
    it('range is inclusive lower, exclusive upper', () => {
        const check = numChecks.range(1, 4);
        check(1).should.be.true();
        check(3).should.be.true();
        check(4).should.be.false();
    });
});

describe('params: checks.str', () => {
    it('regex factory throws a nice error when the pattern fails', () => {
        const check = strChecks.regex(/^[a-z]+$/, 'lowercase');
        // Passing value returns undefined (no throw).
        should(check('hello', 'name')).be.undefined();
        try { check('HELLO', 'name'); should.fail(); }
        catch (err) {
            Array.isArray(err).should.be.true();
            err[0].should.equal(400);
            err[1].should.match(/Invalid lowercase/);
        }
    });

    it('email validates a plausible email', () => {
        should(strChecks.email()('foo@bar.com', 'email')).be.undefined();
        try { strChecks.email()('notanemail', 'email'); should.fail(); }
        catch (err) { err[0].should.equal(400); }
    });

    it('uuid validates correct UUIDs only', () => {
        should(strChecks.uuid()('123e4567-e89b-12d3-a456-426614174000', 'id')).be.undefined();
        try { strChecks.uuid()('xxxxx', 'id'); should.fail(); }
        catch (err) { err[0].should.equal(400); }
    });

    it('time validates hh:mm(:ss)', () => {
        should(strChecks.time()('10:30', 't')).be.undefined();
        should(strChecks.time()('23:59:59', 't')).be.undefined();
        try { strChecks.time()('abc', 't'); should.fail(); }
        catch (err) { err[0].should.equal(400); }
    });

    it('mac validates mac addresses', () => {
        should(strChecks.mac()('aa:bb:cc:dd:ee:ff', 'mac')).be.undefined();
        should(strChecks.mac()('AA-BB-CC-DD-EE-FF', 'mac')).be.undefined();
        try { strChecks.mac()('bogus', 'mac'); should.fail(); }
        catch (err) { err[0].should.equal(400); }
    });

    it('max/min/range check string length', () => {
        strChecks.max(5)('abcde').should.be.true();
        strChecks.max(5)('abcdef').should.be.false();
        strChecks.min(3)('abc').should.be.true();
        strChecks.min(3)('ab').should.be.false();
        strChecks.range(1, 4)('abc').should.be.true();
        strChecks.range(1, 4)('abcd').should.be.false();
    });

    it('regex falls back to wrapping a string pattern if not a RegExp', () => {
        const check = strChecks.regex('[0-9]+', 'digits');
        should(check('123', 'n')).be.undefined();
        try { check('abc', 'n'); should.fail(); }
        catch (err) { err[0].should.equal(400); }
    });
});

describe('params: formatters.num', () => {
    it('add / subtract / multiply / devide / raise', () => {
        numFmt.add(3)(4).should.equal(7);
        numFmt.subtract(3)(4).should.equal(1);
        numFmt.multiply(3)(4).should.equal(12);
        numFmt.devide(2)(10).should.equal(5);
        numFmt.raise(3)(2).should.equal(8);
    });
    it('clamp bounds within [from, to]', () => {
        numFmt.clamp(0, 10)(-5).should.equal(0);
        numFmt.clamp(0, 10)(5).should.equal(5);
        numFmt.clamp(0, 10)(50).should.equal(10);
    });
    it('toTime converts ms to a ms-string', () => {
        numFmt.toTime()(60000).should.equal('1m');
        numFmt.toTime(true)(60000).should.match(/minute/);
    });
});

describe('params: formatters.str', () => {
    it('toStr / toLowerCase / toUpperCase', () => {
        strFmt.toStr()(42).should.equal('42');
        strFmt.toLowerCase()('HI').should.equal('hi');
        strFmt.toUpperCase()('hi').should.equal('HI');
    });
    it('toObj parses JSON', () => {
        strFmt.toObj()('{"a":1}').should.deepEqual({ a: 1 });
    });
    it('toMillis converts ms strings', () => {
        strFmt.toMillis()('1s').should.equal(1000);
    });
    it('toDate produces a Date or throws', () => {
        strFmt.toDate()('2020-01-01', 'd').should.be.instanceOf(Date);
        try { strFmt.toDate()('not a date', 'd'); should.fail(); }
        catch (err) { err[0].should.equal(400); err[1].should.match(/Invalid date/); }
    });
    it('toTime produces a Date with the given time-of-day', () => {
        const d = strFmt.toTime()('10:30', 't');
        d.getHours().should.equal(10);
        d.getMinutes().should.equal(30);
    });
    it('toUuid strips braces, rejects bogus input', () => {
        const valid = '123e4567-e89b-12d3-a456-426614174000';
        strFmt.toUuid()(valid, 'id').should.equal(valid);
        strFmt.toUuid()(`{${valid}}`, 'id').should.equal(valid);
        try { strFmt.toUuid()('not-a-uuid', 'id'); should.fail(); }
        catch (err) { err[0].should.equal(400); err[1].should.match(/Invalid uuid/); }
    });
});

describe('params: top-level factories', () => {
    it('forcedArr wraps scalars, splits CSV strings, preserves arrays', () => {
        const fmt = params.forcedArr.formatters[0];
        fmt([1, 2]).should.deepEqual([1, 2]);
        fmt('a, b,c').should.deepEqual(['a', 'b', 'c']);
        fmt(42).should.deepEqual([42]);
    });

    it('enum only allows the supplied options', () => {
        const def = params.enum('red', 'blue');
        const check = def.checks[0];
        check('red').should.be.true();
        check('green').should.be.false();
    });

    it('regexString returns a ParamDef that uses the given regex', () => {
        const def = params.regexString(/^[a-z]+$/, 'lowercase');
        def.should.have.property('required').which.equals(true);
        def.checks.should.have.length(1);
        // Its single check fails loudly on a mismatch.
        try { def.checks[0]('ABC', 'name'); should.fail(); }
        catch (err) { err[0].should.equal(400); err[1].should.match(/Invalid lowercase/); }
    });

    it('relativeDate has a default of `now`', () => {
        const before = Date.now();
        const d = params.relativeDate.default();
        const after = Date.now();
        d.should.be.instanceOf(Date);
        d.getTime().should.be.within(before, after);
    });
});
