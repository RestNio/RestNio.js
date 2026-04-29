<div align="center">

<a href="https://restn.io"><img src="https://restn.io/logo.png" alt="RestNio" width="220"></a>

### RestNio.js

**One routing model for HTTP _and_ WebSocket.**
Bimodal routes, built-in validation, JWT auth, and shipped TypeScript types — in one small Node package.

[![npm](https://img.shields.io/npm/v/restnio.svg?style=for-the-badge&color=75a3d2&labelColor=303030)](https://www.npmjs.com/package/restnio)
[![node](https://img.shields.io/node/v/restnio.svg?style=for-the-badge&color=75a3d2&labelColor=303030)](https://www.npmjs.com/package/restnio)
[![types](https://img.shields.io/npm/types/restnio.svg?style=for-the-badge&color=75a3d2&labelColor=303030)](./types/index.d.ts)
[![license](https://img.shields.io/npm/l/restnio.svg?style=for-the-badge&color=75a3d2&labelColor=303030)](./LICENSE)

[**restn.io**](https://restn.io) &nbsp;·&nbsp; [**Documentation Wiki**](https://github.com/RestNio/RestNio.js/wiki) &nbsp;·&nbsp; [**npm**](https://www.npmjs.com/package/restnio)

</div>

---

## Install

```bash
npm install restnio
```

## Hello, RestNio

```js
const RestNio = require('restnio');

const app = new RestNio((router, rnio) => {

    router.get('/', () => 'Hello from RestNio');

    router.post('/dog/:name/feed', {
        permissions: ['dog.feed.:name'],
        params: {
            portion: rnio.params.integer
        },
        func: (params) => ({ fed: params.name, amount: params.portion })
    });

    router.ws('/chat', (params, client) => {
        rnio.subs(params.room).obj({ from: client.state.name, text: params.text });
    });

}, { port: 7070 });

app.bind();
```

Same route, both protocols. The POST above works over `curl` **and** over a WebSocket envelope `{ "path": "/dog/fido/feed", "params": { "portion": 2 } }` — no extra wiring.

## What's in the box

- **Bimodal routing** — HTTP and WebSocket share route definitions by default
- **Param validation** — type coercion, shorthand helpers, checks and formatters in one pass
- **JWT auth** — per-route permissions with path-param substitution (`dog.feed.:name`)
- **Plugins** — `serve()`, `cors()`, `ratelimit()` mount as route middleware
- **Binary WS routing** — named binary routes and codec negotiation (JSON + MessagePack)
- **Outbound connectors** — `RestNio.request`, `RestNio.http`, `RestNio.websocket`
- **Interconnect** — persistent peer links between RestNio servers, with reusable route definitions
- **TypeScript** — ships `.d.ts` with path-param type inference

## Documentation

The full guide lives in the **[GitHub Wiki](https://github.com/RestNio/RestNio.js/wiki)**:

| | |
|---|---|
| [Quick Start](https://github.com/RestNio/RestNio.js/wiki/Quick-Start) | Smallest working server |
| [Routing](https://github.com/RestNio/RestNio.js/wiki/Routing) | Bimodal, HTTP-only, WS-only, path params, nesting |
| [Params & Validation](https://github.com/RestNio/RestNio.js/wiki/Params) | Types, checks, formatters, shorthands |
| [Auth & Permissions](https://github.com/RestNio/RestNio.js/wiki/Auth) | JWT tokens, cookie auth, permission templates |
| [WebSocket](https://github.com/RestNio/RestNio.js/wiki/WebSocket) | Routing, subscriptions, broadcasting |
| [Binary Routing](https://github.com/RestNio/RestNio.js/wiki/Binary) | Upload pattern, named binary routes |
| [Codecs](https://github.com/RestNio/RestNio.js/wiki/Codecs) | JSON and MessagePack negotiation |
| [Plugins](https://github.com/RestNio/RestNio.js/wiki/Plugins) | Static serving, CORS, rate limiting |
| [Connectors](https://github.com/RestNio/RestNio.js/wiki/Connectors) | Outbound HTTP + WebSocket clients |
| [Interconnect](https://github.com/RestNio/RestNio.js/wiki/Interconnect) | Persistent server-to-server peer links |
| [TypeScript](https://github.com/RestNio/RestNio.js/wiki/TypeScript) | Declarations and inference |
| [Operations](https://github.com/RestNio/RestNio.js/wiki/Operations) | Proxy config, security checklist |

## Scripts

```bash
npm test                  # all tests
npm run test:unit         # unit tests
npm run test:integration  # integration tests
npm run test:e2e          # end-to-end
npm run test:coverage     # coverage (80% lines/stmts/branches/fns)
npm run test:types        # typecheck .d.ts
npm run build:types       # regenerate .d.ts from JSDoc
```

## License

[MIT](./LICENSE) © 7kasper
