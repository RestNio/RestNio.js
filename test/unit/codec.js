const should = require('should');
const codecs = require('../../lib/codec');

describe('codec', () => {
    describe('registry', () => {
        it('resolves empty/no subprotocol to JSON', () => {
            codecs.resolve().should.equal(codecs.json);
            codecs.resolve('').should.equal(codecs.json);
            codecs.resolve(null).should.equal(codecs.json);
        });

        it('resolves restnio.json to the JSON codec', () => {
            codecs.resolve('restnio.json').should.equal(codecs.json);
        });

        it('returns null for unknown subprotocols', () => {
            should(codecs.resolve('totally.unknown')).be.null();
        });

        it('resolves restnio.msgpack only when @msgpack/msgpack is installed', () => {
            const resolved = codecs.resolve('restnio.msgpack');
            if (codecs.msgpack.available) {
                resolved.should.equal(codecs.msgpack);
            } else {
                should(resolved).be.null();
            }
        });
    });

    describe('json', () => {
        it('passes strings through encode unmodified', () => {
            codecs.json.encode('hello').should.equal('hello');
        });

        it('JSON-encodes objects', () => {
            codecs.json.encode({ a: 1 }).should.equal('{"a":1}');
        });

        it('decodes strings and buffers the same way', () => {
            codecs.json.decode('{"a":1}').should.deepEqual({ a: 1 });
            codecs.json.decode(Buffer.from('{"a":1}')).should.deepEqual({ a: 1 });
        });

        it('never sniffs binary as envelope', () => {
            codecs.json.sniff(Buffer.from([0x80])).should.be.false();
            codecs.json.sniff(Buffer.from([0x81, 0xa1, 0x61, 0x01])).should.be.false();
        });
    });

    describe('msgpack sniff', () => {
        // These tests don't need @msgpack/msgpack installed — sniff is just a
        // byte-range check. Encode/decode live in the integration suite.
        it('accepts fixmap range (0x80 to 0x8f)', () => {
            for (let b = 0x80; b <= 0x8f; b++) {
                codecs.msgpack.sniff(Buffer.from([b])).should.be.true();
            }
        });

        it('accepts map16 (0xde) and map32 (0xdf)', () => {
            codecs.msgpack.sniff(Buffer.from([0xde])).should.be.true();
            codecs.msgpack.sniff(Buffer.from([0xdf])).should.be.true();
        });

        it('rejects bytes outside the map range', () => {
            codecs.msgpack.sniff(Buffer.from([0x00])).should.be.false();
            codecs.msgpack.sniff(Buffer.from([0x7f])).should.be.false();
            codecs.msgpack.sniff(Buffer.from([0x90])).should.be.false(); // fixarray
            codecs.msgpack.sniff(Buffer.from([0xc4])).should.be.false(); // bin 8
            codecs.msgpack.sniff(Buffer.from([0xff])).should.be.false();
        });

        it('rejects empty buffers', () => {
            codecs.msgpack.sniff(Buffer.alloc(0)).should.be.false();
            codecs.msgpack.sniff(null).should.be.false();
        });
    });
});
