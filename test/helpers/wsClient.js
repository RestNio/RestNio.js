/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

const WebSocket = require('ws');

let msgpackImpl = null;
try { msgpackImpl = require('@msgpack/msgpack'); } catch (_) { /* optional */ }

/**
 * Whether the MessagePack runtime is installed in this environment.
 * Tests that need msgpack should gate on this (e.g. `(msgpackAvailable ? it : it.skip)(...)`).
 * @type {boolean}
 */
const msgpackAvailable = msgpackImpl !== null;

/**
 * Opens a websocket connection and resolves once it has fired 'open'.
 *
 * The message handler is attached synchronously at construction time and
 * buffers any frames that arrive before {@link collect} is called. This
 * avoids a race where server-side handlers (e.g. `wsConnect`) send frames
 * between handshake completion and the test attaching its collector.
 *
 * @param {string} wsUrl
 * @param {string} [subprotocol] - optional Sec-WebSocket-Protocol value, e.g. 'restnio.msgpack'.
 * @returns {Promise<WebSocket>}
 */
function connect(wsUrl, subprotocol) {
    return new Promise((resolve, reject) => {
        const ws = subprotocol ? new WebSocket(wsUrl, [subprotocol]) : new WebSocket(wsUrl);
        const buffered = [];
        ws._preCollect = buffered;
        ws.on('message', (data, isBinary) => {
            const entry = { data: Buffer.isBuffer(data) ? data : Buffer.from(data), isBinary };
            if (ws._liveCollector) ws._liveCollector.push(entry);
            else buffered.push(entry);
        });
        ws.once('open', () => resolve(ws));
        ws.once('error', reject);
    });
}

/**
 * Starts collecting incoming frames on a websocket. Drains any frames that
 * arrived before this call (see {@link connect}) and then live-forwards any
 * subsequent frames into the returned array.
 * @param {WebSocket} ws
 * @returns {Array<{data: Buffer, isBinary: boolean}>}
 */
function collect(ws) {
    const got = ws._preCollect ? [...ws._preCollect] : [];
    ws._liveCollector = got;
    return got;
}

/**
 * Encodes a JSON envelope as a string (for sending on a text frame).
 * @param {object} obj
 * @returns {string}
 */
function encodeJson(obj) { return JSON.stringify(obj); }

/**
 * Encodes a MessagePack envelope as a Buffer (for sending on a binary frame).
 * Throws if `@msgpack/msgpack` is not installed.
 * @param {object} obj
 * @returns {Buffer}
 */
function encodeMsgpack(obj) {
    if (!msgpackImpl) throw new Error('@msgpack/msgpack not installed');
    return Buffer.from(msgpackImpl.encode(obj));
}

/**
 * Best-effort decode of a collected entry, based on the codec the client
 * negotiated. Plain strings pass through unchanged.
 * @param {'json'|'msgpack'} codec
 * @param {{data: Buffer, isBinary: boolean}} entry
 * @returns {any}
 */
function decodeAny(codec, entry) {
    if (!entry.isBinary) {
        const s = entry.data.toString();
        try { return JSON.parse(s); } catch (_) { return s; }
    }
    if (codec === 'msgpack' && msgpackImpl) return msgpackImpl.decode(entry.data);
    return entry.data;
}

/**
 * Waits `ms` milliseconds. Useful for letting the server drain before asserting.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Waits until `got.length >= n` or `timeoutMs` elapses. Rejects on timeout.
 * More deterministic than a fixed `wait()` — tests don't slow down the suite
 * when messages arrive quickly.
 * @param {Array<any>} got - the array from `collect()`.
 * @param {number} n
 * @param {number} [timeoutMs=500]
 * @returns {Promise<void>}
 */
async function waitFor(got, n, timeoutMs = 500) {
    const deadline = Date.now() + timeoutMs;
    while (got.length < n) {
        if (Date.now() > deadline) {
            throw new Error(`waitFor timeout: expected ${n} frames, got ${got.length}`);
        }
        await wait(10);
    }
}

module.exports = {
    connect,
    collect,
    encodeJson,
    encodeMsgpack,
    decodeAny,
    wait,
    waitFor,
    msgpackAvailable
};
