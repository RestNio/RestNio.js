# Core Routing Model

RestNio builds on a single, unified routing model that handles both **HTTP** and **WebSocket** connections from the same route definitions. Instead of maintaining two separate server setups, you define a route once and it automatically works over both transports — a WebSocket client sends `{ "path": "/users", "params": { ... } }` and RestNio dispatches it through the exact same handler as an HTTP `POST /users`. This makes it effortless to share validation, permissions, and business logic across REST and real-time channels.

## Handler signature

Every route handler receives `(params, client)`:

- `params` — merged object of path params, query string, and request body (HTTP) or the `params` field of the WS envelope
- `client` — the current connection (HTTP or WebSocket); see [HTTP Behavior](HTTP) and [WebSocket Basics](WebSocket) for what's available
- Return a **string** for plain text, an **object** for JSON, a **Buffer** for binary, or **`Infinity`** to take full manual control of the response

## Bimodal routes (HTTP + WebSocket)

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

## HTTP-only routes

Use the `http`-prefixed variants to exclude WebSocket clients:

```js
router.httpGet('/http-only', () => 'only over HTTP');
router.httpPost('/submit', (params) => ({ received: params }));
// Also: httpPut, httpPatch, httpDelete, httpHead, httpOptions, httpTrace, httpAll
```

## WebSocket-only routes

```js
router.ws('/hello', (params) => `hi ${params.name || 'there'}`);
```

WebSocket clients send a JSON envelope:

```json
{ "path": "/hello", "params": { "name": "alex" } }
```

## Path parameters

Both `:name` and `$name` syntaxes capture a single URL segment and make it available in `params`:

```js
router.get('/dog/:name', (params) => `looking up ${params.name}`);
router.get('/$breed/info', (params) => `breed: ${params.breed}`);
```

## Wildcards

| Pattern | Matches | Does NOT match |
|---------|---------|---------------|
| `/files/**` | `/files/`, `/files/a`, `/files/a/b` | `/files` |
| `/files/*` | `/files/`, `/files/a`, `/files/a/b` | `/files` |
| `/files/*/info` | `/files/img/info`, `/files/doc/info` | `/files/info` |
| `/api**` | `/api`, `/api/`, `/api/v1/users` | — |

The `**` variant without a leading slash (`/api**`) is useful for mounting middleware that should match both the exact path and all sub-paths.

## Advanced path patterns

Because paths are compiled to regular expressions internally, regex metacharacters work directly in path strings. This lets you match complex URL shapes without writing a custom middleware.

**Regex flags** — prefix a route string with `:[flags]/` to set regex flags for the entire path. The most useful is `i` for case-insensitive matching:

```js
// Matches /Dogs, /DOGS, /dogs, /doGs, etc.
router.get(':[i]/dogs', () => ({ dogs: [] }));

// Case-insensitive param
router.get(':[i]/dog/:name', (params) => `found ${params.name}`);
```

**Inline regex** — any character position that is not a `:variable` or `*` is treated as a raw regex fragment. Use standard regex syntax for character classes, quantifiers, and groups:

```js
// Match any 3-digit numeric resource ID in the URL
router.get('/item/\\d{3}', (params, client) => {
  return client.url; // e.g. /item/042
});

// Dot matches any character — useful for format-agnostic routes
router.get('/report.+', () => 'report handler');

// Character class — only /cat or /bat
router.get('/[cb]at', () => 'meow or flap');
```

> **Note**: Because the path is anchored at both ends (`^...$`), regex metacharacters only need escaping if they are meant literally (e.g. use `\\.` for a literal dot, or just accept that `.` matches any character).

**Raw RegExp via `defFull`** — for full control you can register a pre-built regular expression directly. The `fullpath` string must encode the method prefix the same way RestNio does internally, so this is an expert-only escape hatch:

```js
// Register a raw regex — matches GET /item/123 or /item/456
router.defFull(
  /^(?:GET|ws):\/item\/(?:123|456)$/,
  new Route(() => 'matched!')
);
```

## Nested routers

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

## Redirects

```js
router.redirect('/index.html', '/');        // HTTP + WS redirect
router.httpRedirect('/old', '/new', 301);   // HTTP only, permanent
router.wsRedirect('/legacy', '/v2');        // WS only
```

## Special routes with `router.on()`

Register lifecycle events, error overrides, or fully custom route keys:

```js
router.on('wsConnect', () => ({ motd: 'welcome' }));
router.on('404', (params, client) => { throw [404, 'not here']; });
```

See [Default Routes](Default-Routes) for the full list of overridable keys.

---

*[← Quick Start](Quick-Start) | [Params & Validation →](Params)*
