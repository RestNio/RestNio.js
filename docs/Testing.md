# Testing and Coverage

## Available test commands

```bash
npm test                  # run all tests (unit + integration + e2e)
npm run test:unit         # unit tests only
npm run test:integration  # integration tests only (spins up a local server)
npm run test:e2e          # end-to-end scenario tests
npm run test:coverage     # full suite + enforce 80 % line coverage
npm run test:types        # compile test/types/ — fails on any TypeScript error
npm run build:types       # regenerate types/_generated/ from JSDoc
```

## Coverage matrix

| Feature area | Test file(s) |
|---|---|
| HTTP routes, response types, status codes | `test/integration/http.js` |
| WebSocket messaging, state, subscriptions | `test/integration/websocket.js` |
| Binary frames, `setBinRoute` / `clearBinRoute` | `test/integration/binary.js` |
| JWT auth, token issuing/verification, permissions | `test/integration/auth.js` |
| Cookies (read/write/clear, `maxAge` string) | `test/integration/httpCookies.js` |
| CORS headers, preflight, credentials | `test/integration/cors.js` |
| Rate limiting (per address / route / params) | `test/integration/ratelimit.js` |
| Static file serving (`serve` plugin) | `test/integration/serve.js` |
| HTTP connector client | `test/integration/httpConnector.js` |
| WebSocket connector client | `test/integration/wsConnector.js` |
| Param checks, formatters, shorthand helpers | `test/unit/params.js` |
| Route, Router, RouteMap, ClientSet, Options, PermissionSet, Codec | `test/unit/` directory |
| TypeScript type inference, path params, schema types | `test/types/baseline.ts`, `test/types/inference.ts` |

## Running a single test file

```bash
npx mocha test/integration/auth.js
npx mocha test/unit/params.js
```

## Interpreting coverage output

After `npm run test:coverage`, open `coverage/index.html` in a browser to browse line-by-line coverage for every source file under `lib/`.

---

*[← Operational Notes](Operations)*
