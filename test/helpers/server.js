/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

const RestNio = require('../../');

/**
 * @typedef SpawnedServer
 * @property {RestNio} rnio - the RestNio instance.
 * @property {number} port - the actual bound port.
 * @property {string} url - http base url.
 * @property {string} wsUrl - websocket base url.
 * @property {() => Promise<void>} close - shut down server + force-close any open ws.
 */

/**
 * Spins up a RestNio server bound to an ephemeral port for use in integration
 * and e2e tests. Returns the instance plus a `close()` helper that waits for
 * a clean shutdown.
 *
 * Auth is disabled by default so tests don't need to juggle tokens; pass
 * `{ auth: { enabled: true, secret: '...' } }` to opt in.
 *
 * @param {import('../../').RouteBack} routeFn - router function, identical to
 * the one you'd pass to `new RestNio(fn, opts)`.
 * @param {Partial<import('../../').Options>} [overrides] - option overrides.
 * @returns {Promise<SpawnedServer>}
 */
async function spinUp(routeFn, overrides = {}) {
    const opts = {
        port: 0, // ephemeral
        auth: { enabled: false },
        ...overrides
    };
    const rnio = new RestNio(routeFn, opts);
    // `bind()` with port=0 asks the OS for a free port; we resolve on 'listening'.
    await new Promise((resolve, reject) => {
        rnio.httpServer.once('listening', resolve);
        rnio.httpServer.once('error', reject);
        rnio.bind();
    });
    const port = rnio.httpServer.address().port;
    return {
        rnio,
        port,
        url: `http://localhost:${port}`,
        wsUrl: `ws://localhost:${port}`,
        close() {
            return new Promise((resolve) => {
                if (rnio.wsServer) {
                    for (const c of rnio.wsServer.clients) {
                        try { c.terminate(); } catch (_) { /* ignore */ }
                    }
                }
                rnio.httpServer.close(() => resolve());
            });
        }
    };
}

module.exports = { spinUp };
