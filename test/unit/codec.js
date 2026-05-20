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

        // -----------------------------------------------------------------
        // Buffer transparent base64 round-trip. Without these, Node's
        // `Buffer.prototype.toJSON` turns every Buffer into
        // `{type:'Buffer', data:[byte,...]}` on encode, which decodes back
        // to a plain object — silent corruption for any consumer that
        // expects raw bytes (HttpClient.bin → response.write, file write,
        // etc.). The codec wraps Buffer / Uint8Array as `{__rnbin:'<b64>'}`
        // on encode and rehydrates on decode.
        // -----------------------------------------------------------------
        describe('Buffer transparent base64', () => {
            it('round-trips a top-level Buffer back to a Buffer', () => {
                const buf = Buffer.from('hello world');
                const wire = codecs.json.encode(buf);
                wire.should.be.a.String();
                const back = codecs.json.decode(wire);
                Buffer.isBuffer(back).should.be.true();
                back.toString('utf8').should.equal('hello world');
                back.equals(buf).should.be.true();
            });

            it('round-trips a Buffer nested in an object', () => {
                const buf = Buffer.from([0x00, 0x01, 0xff, 0x7f, 0x80]);
                const wire = codecs.json.encode({ name: 'x', payload: buf, n: 7 });
                const back = codecs.json.decode(wire);
                back.name.should.equal('x');
                back.n.should.equal(7);
                Buffer.isBuffer(back.payload).should.be.true();
                back.payload.equals(buf).should.be.true();
            });

            it('round-trips Buffers in arrays', () => {
                const a = Buffer.from('a');
                const b = Buffer.from('bb');
                const wire = codecs.json.encode([a, b, 'plain']);
                const back = codecs.json.decode(wire);
                back.length.should.equal(3);
                Buffer.isBuffer(back[0]).should.be.true();
                Buffer.isBuffer(back[1]).should.be.true();
                back[0].toString('utf8').should.equal('a');
                back[1].toString('utf8').should.equal('bb');
                back[2].should.equal('plain');
            });

            it('round-trips a Uint8Array as Buffer', () => {
                const u8 = new Uint8Array([1, 2, 3, 4]);
                const back = codecs.json.decode(codecs.json.encode({ data: u8 }));
                Buffer.isBuffer(back.data).should.be.true();
                Array.from(back.data).should.deepEqual([1, 2, 3, 4]);
            });

            it('round-trips a Buffer slice that shares an underlying ArrayBuffer', () => {
                // Buffer.subarray gives a view onto the SAME ArrayBuffer with a
                // non-zero byteOffset. The encoder must respect byteOffset /
                // byteLength — otherwise the base64 payload spans the whole
                // parent buffer and the round-trip yields the wrong bytes.
                const parent = Buffer.from('header-payload-tail');
                const slice  = parent.subarray(7, 14); // 'payload'
                slice.toString('utf8').should.equal('payload');
                const back = codecs.json.decode(codecs.json.encode({ s: slice }));
                back.s.toString('utf8').should.equal('payload');
            });

            it('does not mangle an empty Buffer', () => {
                const wire = codecs.json.encode({ b: Buffer.alloc(0) });
                const back = codecs.json.decode(wire);
                Buffer.isBuffer(back.b).should.be.true();
                back.b.length.should.equal(0);
            });

            it('leaves plain `{type:"Buffer", data:[...]}` payloads alone', () => {
                // Apps that genuinely transit an object shaped like
                // Buffer.toJSON()'s output (without it actually being a
                // Buffer) must round-trip as a plain object. The replacer
                // checks the holder's ORIGINAL value (`this[key]`), not the
                // post-`toJSON` shape, so this case is safe.
                const obj = { type: 'Buffer', data: [1, 2, 3] };
                const back = codecs.json.decode(codecs.json.encode({ x: obj }));
                back.x.should.deepEqual(obj);
                Buffer.isBuffer(back.x).should.be.false();
            });

            it('leaves objects with a stray __rnbin sibling alone', () => {
                // Reviver only rehydrates objects that have EXACTLY the
                // wrapper key — anything else is app data that happened to
                // pick the same key.
                const wire   = codecs.json.encode({ x: { __rnbin: 'aGk=', meta: 1 } });
                const back   = codecs.json.decode(wire);
                Buffer.isBuffer(back.x).should.be.false();
                back.x.__rnbin.should.equal('aGk=');
                back.x.meta.should.equal(1);
            });

            it('round-trips a moderately large Buffer (1 MiB random bytes)', () => {
                const buf = require('crypto').randomBytes(1024 * 1024);
                const back = codecs.json.decode(codecs.json.encode(buf));
                Buffer.isBuffer(back).should.be.true();
                back.length.should.equal(buf.length);
                back.equals(buf).should.be.true();
            });
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
