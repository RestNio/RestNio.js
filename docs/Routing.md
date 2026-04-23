# Core Routing Model

## Handler signature

Every route handler receives `(params, client)`:

- `params` — merged object of path params, query string, and request body
- `client` — the current connection (HTTP or WebSocket)
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

Both `:name` and `$name` syntaxes are supported:

```js
router.get('/dog/:name', (params) => `looking up ${params.name}`);
router.get('/$breed/info', (params) => `breed: ${params.breed}`);
```

Use `**` to match any subpath (wildcard):

```js
router.get('/files/**', (params, client) => { /* serve anything under /files/ */ });
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
