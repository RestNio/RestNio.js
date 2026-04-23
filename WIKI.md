# RestNio.js — Complete Guide

A practical, progressive guide that starts with the smallest working server and builds up through routing, validation, auth, WebSocket messaging, binary routing, plugins, and connectors.

---

## Table of Contents

- [Why RestNio](#why-restnio)
- [Install](#install)
- [1) Quick Start: Smallest Server](#1-quick-start-smallest-server)
- [2) Core Routing Model](#2-core-routing-model)
- [3) Params, Validation, and Formatting](#3-params-validation-and-formatting)
- [4) Auth and Permissions (JWT)](#4-auth-and-permissions-jwt)
- [5) HTTP Behavior and Client Helpers](#5-http-behavior-and-client-helpers)
- [6) WebSocket Basics](#6-websocket-basics)
- [7) Binary WebSocket Routing](#7-binary-websocket-routing)
- [8) Codec Negotiation](#8-codec-negotiation-json-and-messagepack)
- [9) Built-in Plugins](#9-built-in-plugins)
- [10) Outbound Connectors](#10-outbound-connectors)
- [11) Default Routes You Can Override](#11-default-routes-you-can-override)
- [12) JavaScript and TypeScript Usage](#12-javascript-and-typescript-usage)
- [13) A Progressive Starter You Can Extend](#13-a-progressive-starter-you-can-extend)
- [14) Operational Notes](#14-operational-notes)
- [15) Testing and Type Checks](#15-testing-and-type-checks)
- [16) Feature Coverage Matrix](#16-feature-coverage-matrix)

---

## Why RestNio

RestNio gives you one routing model for both HTTP and WebSocket:

- Same route style for HTTP and WebSocket — bimodal by default
- Built-in param parsing, type coercion, validation, and formatting
- Built-in JWT auth with permission checks and parameter-level substitution
- Static file serving, CORS, and rate limiting as first-class plugins
- Outbound HTTP and WebSocket connectors included
- JavaScript-first codebase with shipped TypeScript declarations and path-param inference

---

## Install

```bash
npm install restnio
```

---

## 1) Quick Start: Smallest Server

```js
const RestNio = require('restnio');

const app = new RestNio((router) => {
  router.get('/', () => 'Hello from RestNio');
}, {
  port: 7070
});

app.bind();
```

```bash
curl http://localhost:7070/
# Hello from RestNio
```

The constructor takes a **router callback** and an **options object**. `app.bind()` starts listening. Default port is `7070`.

---

## 2) Core Routing Model

### Handler signature

Every route handler receives `(params, client)`:

- `params` — merged object of path params, query string, and request body
- `client` — the current connection (HTTP or WebSocket)
- Return a **string** for plain text, an **object** for JSON, a **Buffer** for binary, or **`Infinity`** to take full manual control of the response

### Bimodal routes (HTTP + WebSocket)

These methods register a route for both HTTP and WebSocket at the same time:

| Method | Notes |
|--------|-------|
| `router.get(path, def)` | HTTP GET + WS |
| `router.post(path, def)` | HTTP POST + WS |
| `router.put(path, def)` | HTTP PUT + WS |
| `router.patch(path, def)` | HTTP PATCH + WS |
| `router.delete(path, def)` | HTTP DELETE + WS |
| `router.head(path, def)` | HTTP HEAD + WS |
| `router.options(path, def)` | HTTP OPTIONS + WS |
| `router.trace(path, def)` | HTTP TRACE + WS |
| `router.all(path, def)` | All HTTP methods + WS |

```js
router.get('/status', () => ({ ok: true }));
router.post('/echo', (params) => params);
```

### HTTP-only routes

Use the `http`-prefixed variants when you want to exclude WebSocket clients:

```js
router.httpGet('/http-only', () => 'only over HTTP');
router.httpPost('/submit', (params) => ({ received: params }));
// Also: httpPut, httpPatch, httpDelete, httpHead, httpOptions, httpTrace, httpAll
```

### WebSocket-only routes

```js
router.ws('/hello', (params) => `hi ${params.name || 'there'}`);
```

WebSocket clients send a JSON envelope:

```json
{ "path": "/hello", "params": { "name": "alex" } }
```

### Path parameters

Both `:name` and `$name` syntaxes are supported:

```js
router.get('/dog/:name', (params) => `looking up ${params.name}`);
router.get('/$breed/info', (params) => `breed: ${params.breed}`);
```

Use `**` to match any subpath (wildcard):

```js
router.get('/files/**', (params, client) => { /* serve anything under /files/ */ });
```

### Nested routers

```js
router.use('/api', (api, rnio) => {
  api.get('/health', () => ({ service: 'ok' }));
  api.post('/data', (params) => params);
});
```

Pass `true` as the third argument to automatically redirect the un-trailed path to the trailed one:

```js
router.use('/docs', docsRouter, true);
// GET /docs  →  307  /docs/
```

### Redirects

```js
router.redirect('/index.html', '/');        // HTTP + WS redirect
router.httpRedirect('/old', '/new', 301);   // HTTP only, permanent
router.wsRedirect('/legacy', '/v2');        // WS only
```

### Special routes with `router.on()`

Register lifecycle events, error overrides, or fully custom route keys:

```js
router.on('wsConnect', () => ({ motd: 'welcome' }));
router.on('404', (params, client) => { throw [404, 'not here']; });
```

---

## 3) Params, Validation, and Formatting

A route definition object can contain:

| Field | Description |
|-------|-------------|
| `func` | Route handler `(params, client) => result` |
| `params` | Map of parameter names to `ParamDef` objects |
| `permissions` | Array of required permission strings |
| `isActive` | `false` for middleware-style routes that set headers but return nothing |

### ParamDef structure

```js
{
  required:           true,       // reject the request if the param is absent
  ignoreEmptyString:  true,       // treat '' as absent
  default:            'fallback', // default value, or a () => value function
  type:               'string',   // typeof check applied before formatters run
  prechecks:          [...],      // validators BEFORE formatters
  formatters:         [...],      // transformers applied in order
  checks:             [...]       // validators AFTER formatters
}
```

Processing order per parameter: **prechecks → formatters → checks**.

### Full example

```js
const RestNio = require('restnio');

const app = new RestNio((router, rnio) => {
  router.post('/users', {
    params: {
      name: {
        required: true,
        type: 'string',
        formatters: [rnio.params.formatters.str.toLowerCase()],
        checks: [
          rnio.params.checks.str.min(3),
          rnio.params.checks.str.max(40)
        ]
      },
      age: {
        required: true,
        type: 'number',
        checks: [
          rnio.params.checks.num.isInteger(),
          rnio.params.checks.num.min(0),
          rnio.params.checks.num.max(130)
        ]
      },
      role: { default: 'user' }
    },
    func: (params) => ({ created: true, params })
  });
});
```

### Built-in param shorthand helpers

Access via `rnio.params` (instance) or `RestNio.params` (static):

| Helper | Type | Description |
|--------|------|-------------|
| `params.required` | any | Required, no type check |
| `params.string` | string | Required string |
| `params.forcedString` | string | Required, cast to string |
| `params.forcedArr` | array | Required, cast to array (splits comma-separated strings) |
| `params.number` | number | Required number |
| `params.integer` | integer | Required whole number |
| `params.boolean` | boolean | Required boolean |
| `params.email` | string | Required valid email (normalised to lowercase) |
| `params.mac` | string | Required MAC address |
| `params.date` | Date | Required, parsed from string or ms timestamp |
| `params.uuid` | string | Required RFC4122 UUID (braces stripped) |
| `params.time` | Date | Required `hh:mm[:ss]` string → today's Date |
| `params.relativeTime` | number | Required, zeit/ms string or number → milliseconds |
| `params.relativeDate` | Date | Optional (defaults to now), relative offset → absolute Date |
| `params.enum(...opts)` | string | Required, value must be one of the given options |
| `params.regexString(re, type)` | string | Required, value must match regex |

```js
router.post('/order', {
  params: {
    status:   rnio.params.enum('pending', 'shipped', 'delivered'),
    sku:      rnio.params.regexString(/^[A-Z]{3}-\d{4}$/, 'SKU'),
    quantity: rnio.params.integer,
    notes:    { default: '' }
  },
  func: (params) => ({ queued: params })
});
```

### Built-in checks

**Numeric** (`rnio.params.checks.num`):

| Check | Description |
|-------|-------------|
| `.isInteger()` | Must be a whole number |
| `.min(n)` | Must be `>= n` |
| `.max(n)` | Must be `<= n` |
| `.range(from, to)` | Must be `>= from` and `< to` |

**String** (`rnio.params.checks.str`):

| Check | Description |
|-------|-------------|
| `.email()` | Valid email format |
| `.uuid()` | Valid RFC4122 UUID |
| `.time()` | Valid `hh:mm[:ss]` string |
| `.mac()` | Valid MAC address |
| `.regex(pattern, type)` | Must match regex |
| `.min(n)` | Length `>= n` |
| `.max(n)` | Length `<= n` |
| `.range(from, to)` | Length `>= from` and `< to` |

### Built-in formatters

**Numeric** (`rnio.params.formatters.num`):

| Formatter | Description |
|-----------|-------------|
| `.add(n)` | Add n |
| `.subtract(n)` | Subtract n |
| `.multiply(factor)` | Multiply |
| `.devide(divisor)` | Divide |
| `.raise(exponent)` | Raise to a power |
| `.clamp(from, to)` | Clamp to range (inclusive) |
| `.toTime(long?)` | ms number → zeit/ms string (`60000` → `"1m"`) |

**String** (`rnio.params.formatters.str`):

| Formatter | Description |
|-----------|-------------|
| `.toStr()` | Cast to string |
| `.toLowerCase()` | Lowercase |
| `.toUpperCase()` | Uppercase |
| `.toObj()` | Parse JSON string → object |
| `.toMillis()` | zeit/ms string → number of milliseconds |
| `.toDate()` | Date string or ms number → `Date` object |
| `.toTime()` | `hh:mm[:ss]` string → today's `Date` |
| `.toUuid()` | Strip braces from UUID string |

---

## 4) Auth and Permissions (JWT)

Auth is **enabled by default** with a random secret. Configure it explicitly in production:

```js
const app = new RestNio((router, rnio) => {

  // Issue a token with a list of permissions
  router.get('/token', () => rnio.token.grant(['dogs.read', 'dogs.feed.fido']));

  // Verify a token manually
  router.post('/verify', {
    params: { token: rnio.params.string },
    func:   (params) => rnio.token.verify(params.token)
  });

  // Require a permission to access this route
  router.get('/dogs', {
    permissions: ['dogs.read'],
    func: () => ({ dogs: ['fido', 'rex'] })
  });

  // Permission template — :name is substituted from the matched path param
  router.post('/dogs/feed/:name', {
    permissions: ['dogs.feed.:name'],
    func: (params) => ({ fed: params.name })
  });

}, {
  auth: {
    enabled:    true,
    type:       'jwt',
    algorithm:  'HS256',
    secret:     'change-me-in-production',
    sign:       { expiresIn: '1h', issuer: 'RestNio' },
    verify:     { issuer: ['RestNio'] },
    cookietoken: true  // also accept a token from a cookie named 'token'
  }
});
```

### Sending a token

HTTP clients include it in the `token` request header:

```bash
curl -H "token: <jwt>" http://localhost:7070/dogs
```

WebSocket clients include it directly in each message envelope:

```json
{ "path": "/dogs", "token": "<jwt>", "params": {} }
```

### Auth option summary

| Option | Default | Description |
|--------|---------|-------------|
| `auth.enabled` | `true` | Enable/disable auth system |
| `auth.type` | `'jwt'` | Auth type (currently only `jwt`) |
| `auth.algorithm` | `'HS256'` | JWT algorithm |
| `auth.secret` | random UUID | Shared secret (symmetric). Set to `null` when using key pairs |
| `auth.privateKey` | `null` | Private key for asymmetric signing |
| `auth.publicKey` | `null` | Public key for asymmetric verification |
| `auth.sign.expiresIn` | `'1h'` | Token lifetime (zeit/ms string or seconds) |
| `auth.sign.issuer` | `'RestNio'` | Issuer claim embedded in the token |
| `auth.verify.issuer` | `['RestNio']` | Accepted issuers on verification |
| `auth.cookietoken` | `true` | Auto-verify token from a cookie named `token` |

---

## 5) HTTP Behavior and Client Helpers

### Response types by return value

| Return value | HTTP behavior |
|---|---|
| `string` | `200` plain text, `content-type: text/plain` |
| `object` | `200` JSON, `content-type: application/json` |
| `Buffer` | `200` binary, `content-type: application/octet-stream` |
| `Infinity` | No automatic response — handler controls the connection |
| `undefined` (no return) | Fall through to next matching route; `200 OK` if nothing else responded |

### Taking manual control

Return `Infinity` and use `client` directly to write headers, stream bytes, or redirect:

```js
router.get('/download', (params, client) => {
  client.header('content-type', 'application/zip');
  client.bin(Buffer.from([0xde, 0xad, 0xbe, 0xef]));
  return Infinity;
});

router.get('/go', (params, client) => {
  return client.redirect('/destination', 302);
  // client.redirect() returns Infinity automatically
});
```

### Reading request information

```js
client.ip          // remote IP string or null
client.headers     // raw request headers (object)
client.cookies     // parsed cookie map — HTTP only
client.type        // 'http' or 'ws'
client.state       // app-owned free-form bag; RestNio never touches it
```

### Cookies (HTTP only)

```js
// Read
router.get('/whoami', (params, client) => ({
  session: client.cookie('session')
}));

// Write
router.get('/login', (params, client) => {
  client.cookie('session', 'abc123', {
    maxAge:   3600,       // seconds, or a zeit/ms string like '1h'
    httpOnly: true,
    sameSite: 'Strict',
    secure:   true,
    path:     '/'
  });
  return { ok: true };
});

// Clear
router.get('/logout', (params, client) => {
  client.clearCookie('session');
  return { loggedOut: true };
});
```

### Setting response headers

```js
router.get('/data', (params, client) => {
  client.header('x-request-id', '12345');
  return { data: true };
});
```

---

## 6) WebSocket Basics

### Lifecycle hooks

```js
// Fires for every connecting client — return value is sent as MOTD
router.on('wsConnect', () => ({ motd: 'welcome!' }));

// Fires on disconnect — params.reason is [closeCode, message]
router.on('wsClose', (params) => {
  console.log('client left:', params.reason);
});
```

Multiple `wsConnect` handlers are all fired in order, each sending a separate message to the client.

### Message routing

Clients send `{ path, params?, token? }` and the matching `router.ws()` handler runs:

```js
router.ws('/ping', () => ({ pong: true }));

router.ws('/echo', (params) => ({ echo: params.message }));
```

### Sending from the server side

```js
router.ws('/demo', (params, client) => {
  client.str('raw string');            // send a text frame
  client.obj({ hello: 'world' });      // codec-encoded frame (JSON by default)
  client.bin(Buffer.from([1, 2, 3])); // binary frame
  client.close([1000, 'bye']);          // close with code + reason
});
```

### Connection-level state

`client.state` is a free-form bag that persists for the lifetime of the WebSocket connection. RestNio never reads or writes it:

```js
router.ws('/init', (params, client) => {
  client.state.userId   = params.userId;
  client.state.joinedAt = Date.now();
  return { ready: true };
});

router.ws('/profile', (params, client) => ({
  userId: client.state.userId,
  ageMs:  Date.now() - client.state.joinedAt
}));
```

### Subscriptions and broadcasting

`client.subscribe(name)` adds the client to a named group. `rnio.subs(name)` returns a `ClientSet` — an iterable `Set` that also exposes broadcast helpers (`.str()`, `.obj()`, `.bin()`). The map auto-creates an empty set for unknown rooms, so iteration is always safe.

```js
router.ws('/join', (params, client) => {
  client.subscribe(params.room || 'main');
  return { joined: params.room || 'main' };
});

// Broadcast helpers — one call reaches all clients in the room
router.ws('/announce', (params) => {
  rnio.subs(params.room).str(params.message);
  return { sent: true };
});

// For per-client logic, iterate the set directly
router.ws('/notify', (params, client) => {
  for (const c of rnio.subs('main')) {
    c.obj({ from: client.state.name, text: params.text });
  }
  return { sent: true };
});
```

---

## 7) Binary WebSocket Routing

By default, unhandled binary frames trigger the built-in `wsBin` error route (throws `400`). Override it or route frames to named handlers.

### Named binary route (upload pattern)

```js
// 1) Client sends a JSON envelope to begin the upload
router.ws('/upload-start', (params, client) => {
  client.state.file         = Buffer.alloc(0);
  client.state.expectedSize = params.size || 0;
  client.setBinRoute('file');          // all subsequent binary frames → wsBin-file
  return { acceptingBinary: true };
});

// 2) Each binary frame arrives here
router.wsBin('file', (params, client) => {
  // params.data — the raw Buffer for this frame
  // params.size — byte length of this frame
  client.state.file = Buffer.concat([client.state.file, params.data]);
  if (client.state.file.length >= client.state.expectedSize) {
    const size = client.state.file.length;
    client.clearBinRoute();            // stop routing to wsBin-file
    client.state.file = null;
    return { uploaded: size };
  }
  // no return → stay in binary-receive mode
});
```

### Default binary fallback

```js
router.wsBin((params) => {
  console.log('stray binary frame, size:', params.size);
  return { stray: true, size: params.size };
});
```

### Binary routing API

| API | Description |
|-----|-------------|
| `router.wsBin(handler)` | Default binary fallback route |
| `router.wsBin(name, handler)` | Named binary route (`wsBin-<name>`) |
| `client.setBinRoute(name)` | Route all incoming binary to `wsBin-<name>` |
| `client.clearBinRoute()` | Return to default binary behavior |

Named and default handlers both receive `{ data: Buffer, size: number }`.

---

## 8) Codec Negotiation (JSON and MessagePack)

The WebSocket wire format is negotiated at handshake time via the `Sec-WebSocket-Protocol` header.

| Protocol header value | Frame type | Notes |
|-----------------------|-----------|-------|
| *(none)* or `restnio.json` | Text | Default. Envelopes are UTF-8 JSON. |
| `restnio.msgpack` | Binary | MessagePack envelopes. Requires optional dep `@msgpack/msgpack`. |

The server negotiates automatically — no extra server-side code required. For MessagePack clients the server uses a first-byte sniff to distinguish codec envelopes from raw binary data. `setBinRoute()` always takes priority over the sniff.

```js
RestNio.codecs   // inspect, or register additional codecs
```

---

## 9) Built-in Plugins

Plugins are router functions — mount them with `router.use()`.

### Static file serving

```js
// Serve a directory
router.use('/public', rnio.serve('./public/'));

// Serve a single file at a custom path
router.use('/readme', rnio.serve('./README.md'));

// With options
router.use('/docs', rnio.serve('./docs/', {
  cache:     true,         // read all files into memory at startup
  recursive: true,         // serve subdirectories (default: true)
  doListing: true,         // generate HTML index pages when there's no index.html
  index:     'index.html'  // filename treated as directory index
}));
```

`serve` also works over WebSocket — binary file contents are pushed as a binary frame.

### CORS

```js
// Open API — allow all origins
router.use('/api**', rnio.cors());

// Restricted to one origin
router.use('/api**', rnio.cors({
  origin:           'https://example.com',
  allowCredentials: true,
  headers:          '*',    // echo Access-Control-Request-Headers, or list them explicitly
  preflight:        true,   // handle OPTIONS preflight (default: true)
  maxAge:           86400   // cache preflight response for 24 h
}));
```

### Rate limiting

```js
// 5 requests per minute per IP
router.use('/login', rnio.ratelimit({
  per:     'address',   // 'address' (default) | 'route' | 'params'
  scope:   'hard',      // 'hard' (default) = whole scope counts; 'soft' = per exact path
  limit:   5,
  time:    '1m',
  code:    429,
  message: 'Too many login attempts',
  headers: true         // send x-ratelimit-* headers (default: true)
}));

// Rate-limit per parameter value (e.g. per userId)
router.use('/api', rnio.ratelimit({
  per:       'params',
  perParams: ['userId'],
  limit:     100,
  time:      '1h'
}));

// Custom skip logic
router.use('/api', rnio.ratelimit({
  limit: 60,
  time:  '1m',
  skip:  (params, client) => client.hasPerm('admin')
}));
```

Rate-limit response headers: `x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-reset`, `retry-after`.

---

## 10) Outbound Connectors

RestNio includes HTTP and WebSocket clients for use inside routes or server-side logic.

### One-shot HTTP request

```js
const RestNio = require('restnio');

// Simple GET
RestNio.request('GET', 'http://api.example.com/items', (body, res) => {
  console.log(res.statusCode, JSON.parse(body));
});

// POST with a JSON body
RestNio.request('POST', 'http://api.example.com/items', { name: 'widget' }, (body) => {
  console.log(body);
});
```

### HTTP connector (reusable client)

```js
const api = new RestNio.http('http://api.example.com', {
  token: 'jwt-here'       // included as a header in every request
}, true /* JSON mode */);

api.get(    { path: '/items' },                         (body) => console.log(body));
api.post(   { path: '/items', params: { name: 'x' } }, (body) => console.log(body));
api.delete( { path: '/items/1' },                       (body) => console.log(body));
```

### WebSocket connector client

```js
const ws = RestNio.websocket(
  'ws://localhost:7070',
  (data)         => console.log('received:', data),          // onMessage (pre-parsed)
  (data, client) => {                                         // onConnect
    client.obj({ path: '/join', params: { room: 'main' } });
  },
  ()             => console.log('disconnected')              // onClose
);

// Send at any time
ws.obj({ path: '/chat', params: { text: 'hello' } });
```

---

## 11) Default Routes You Can Override

These route keys are pre-registered in `options.default.routes`:

| Key | When it fires | Default behavior |
|-----|---------------|-----------------|
| `'404'` | No route matched | `throw [404, 'page not found']` |
| `'403'` | Permission check failed | `throw [403, 'permission error']` |
| `'500'` | Unhandled exception | `throw [500, 'internal server error']` |
| `'wsConnect'` | WebSocket client connects | no-op (no MOTD) |
| `'wsClose'` | WebSocket client disconnects | no-op |
| `'wsBin'` | Unhandled binary frame arrives | `throw [400, 'no binary handler active']` |

Override via `router.on()` inside the constructor:

```js
router.on('wsConnect', () => ({ motd: 'hello!', version: '1.0' }));
router.on('404', (params, client) => { throw [404, 'nothing here']; });
```

Or via the constructor options (useful for shared config objects):

```js
const app = new RestNio((router) => { /* ... */ }, {
  default: {
    routes: {
      '404': () => { throw [404, 'custom not found']; },
      '403': () => { throw [403, 'custom forbidden']; }
    }
  }
});
```

### Throwing errors from route handlers

```js
throw [404, 'not found'];   // client receives: { code: 404, error: 'not found' }
throw [400, 'bad input'];
throw [403, 'no access'];
throw [500, 'something broke'];
```

### isActive: false — middleware-style routes

Set `isActive: false` on routes that only set headers or perform side-effects and never send a response. They run but do not satisfy the "route responded" check, so subsequent routes still execute. This is exactly how the built-in CORS plugin works:

```js
router.httpAll('', {
  isActive: false,
  func: (params, client) => {
    client.header('access-control-allow-origin', '*');
  }
});
```

---

## 12) JavaScript and TypeScript Usage

### JavaScript

Works out of the box — no build step. JSDoc annotations throughout the source give full VS Code IntelliSense in plain `.js` files:

```js
const RestNio = require('restnio');
```

### TypeScript

The package ships pre-built declarations and declares them in `package.json`:

```ts
import RestNio from 'restnio';

const app = new RestNio((router, rnio) => {

  // params.name inferred as string from the :name path segment
  router.get('/dog/:name', (params) => {
    return { dog: params.name };
  });

  // params.age inferred as number from the schema type literal
  router.post('/register', {
    params: {
      age: { required: true, type: 'number' as const }
    },
    func: (params) => {
      const age: number = params.age;
      return { ok: true, age };
    }
  });

  // Path params + schema params combine in the handler signature
  router.post('/dog/:name/feed', {
    params: {
      portion: { required: true, type: 'number' as const }
    },
    func: (params) => {
      const name: string = params.name;    // from :name
      const amt:  number = params.portion; // from schema
      return { fed: name, amount: amt };
    }
  });

}, { port: 7070 });
```

Build declarations (runs automatically on `npm pack`):

```bash
npm run build:types
```

Validate type correctness:

```bash
npm run test:types
```

---

## 13) A Progressive Starter You Can Extend

Copy this file and start from here.

```js
const RestNio = require('restnio');

const app = new RestNio((router, rnio) => {

  // ── HTTP ─────────────────────────────────────────────────────────────

  router.get('/', () => 'RestNio is running');

  router.post('/sum', {
    params: {
      a: rnio.params.number,
      b: rnio.params.number
    },
    func: ({ a, b }) => ({ result: a + b })
  });

  // ── Auth ──────────────────────────────────────────────────────────────

  router.get('/token', () => rnio.token.grant(['chat.send']));

  router.post('/secure/ping', {
    permissions: ['chat.send'],
    func: () => ({ pong: true })
  });

  // ── WebSocket ─────────────────────────────────────────────────────────

  router.on('wsConnect', () => ({ motd: 'connected' }));

  router.ws('/join', (params, client) => {
    client.state.name = params.name || 'anonymous';
    client.subscribe(params.room || 'main');
    return { joined: params.room || 'main' };
  });

  router.ws('/chat', {
    permissions: ['chat.send'],
    func: (params, client) => {
      rnio.subs(params.room || 'main').obj({
        from: client.state.name,
        text: params.text
      });
      return { sent: true };
    }
  });

  router.on('wsClose', (params) => {
    console.log('disconnected:', params.reason);
  });

  // ── Plugins ───────────────────────────────────────────────────────────

  router.use('/docs',     rnio.serve('./public/', { doListing: true }));
  router.use('/api**',    rnio.cors());
  router.use('/secure**', rnio.ratelimit({ limit: 20, time: '1m' }));

}, {
  port: 7070,
  auth: {
    enabled:   true,
    type:      'jwt',
    algorithm: 'HS256',
    secret:    process.env.JWT_SECRET || 'change-me',
    sign:      { expiresIn: '1h',   issuer: 'RestNio' },
    verify:    { issuer: ['RestNio'] }
  }
});

app.bind();
console.log('listening on http://localhost:7070');
```

---

## 14) Operational Notes

### Server options

| Option | Default | Description |
|--------|---------|-------------|
| `port` | `7070` | HTTP/WS listen port |
| `http.enabled` | `true` | Enable HTTP server |
| `websocket.enabled` | `true` | Enable WebSocket server |
| `websocket.timeout` | `30000` | Inactivity timeout (ms) before ping/disconnect |
| `websocket.hardClose` | `10000` | Force-terminate delay after `client.close()` (ms) |

### Proxy and IP extraction

Running behind a reverse proxy? Configure trusted proxies so `client.ip` resolves correctly:

```js
{
  proxy: {
    trustedProxies: ['127.0.0.1', '10.0.0.0/8'],
    rejectUnknown:  false
  }
}
```

### Production security checklist

- Source `auth.secret` from an environment variable, not source code
- For public-key algorithms set `auth.secret: null` and provide `privateKey`/`publicKey`
- Consider disabling `auth.cookietoken` if your use case does not require it
- Apply rate limiting before expensive or auth-heavy routes
- Configure `proxy.trustedProxies` behind a load balancer to prevent IP spoofing

---

## 15) Testing and Type Checks

```bash
npm test                  # all tests
npm run test:unit         # unit tests only
npm run test:integration  # integration tests only
npm run test:e2e          # end-to-end tests
npm run test:coverage     # coverage report (enforces 80% on lines/stmts/branches/fns)
npm run test:types        # TypeScript declaration correctness
npm run build:types       # regenerate .d.ts files from JSDoc
```

---

## 16) Feature Coverage Matrix

| Feature | Test file(s) |
|---------|-------------|
| HTTP routing, response types, path params, POST body | `test/integration/http.js` |
| WebSocket routing, wsConnect, wsClose, subscriptions | `test/integration/websocket.js` |
| Binary routing, codec negotiation (JSON + MessagePack) | `test/integration/binary.js` |
| JWT auth, token.grant, permissions, 403 behavior | `test/integration/auth.js` |
| Cookies: read, write, clear, cookie-token fallback | `test/integration/httpCookies.js` |
| CORS plugin: simple, preflight, credentials | `test/integration/cors.js` |
| Rate limit plugin: address/params scope, skip, headers | `test/integration/ratelimit.js` |
| Static file serving: cache, listing, index.html | `test/integration/serve.js` |
| HTTP connector: GET, POST, callbacks | `test/integration/httpConnector.js` |
| WebSocket connector: connect, send, close | `test/integration/wsConnector.js` |
| Param checks and formatters | `test/unit/params.js` |
| Route, Router, ClientSet, PermissionSet, RouteMap | `test/unit/` |
| TypeScript declarations and path-param inference | `test/types/baseline.ts`, `test/types/inference.ts` |