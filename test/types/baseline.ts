/**
 * Baseline TypeScript usage — proves the auto-generated `.d.ts` files
 * (emitted from JSDoc by `npm run build:types`) are import-able and
 * type-check end to end. The handler `params` are still loosely typed
 * here; that's what the inference layer (added next) will tighten.
 */
import RestNio from '../../';

const server = new RestNio((router, rnio) => {

    router.get('/', () => 'INDEX');

    router.get('/dog/:name', (params, client) => {
        return `looking up ${params.name}`;
    });

    router.post('/claimdog', {
        params: {
            name: rnio.params.string,
            age: rnio.params.integer
        },
        permissions: ['dog.claim'],
        func: (params) => {
            return { saved: true, name: params.name };
        }
    });

    router.all('/dog/:name/feed', {
        permissions: ['dog.feed.:name'],
        func: (params, client) => {
            client.state.lastFed = Date.now();
            return { fed: params.name };
        }
    });

}, {
    port: 80,
    auth: {
        type: 'jwt',
        algorithm: 'HS256',
        secret: 'test',
        sign: { expiresIn: '1h', issuer: 'RestNio' },
        verify: { issuer: ['RestNio'] }
    }
});

server.bind();
