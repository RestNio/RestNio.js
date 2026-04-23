# Built-in Plugins

Plugins are router functions — mount them with `router.use()`. RestNio ships three built-in plugins that cover the most common cross-cutting concerns in a web server: static file serving, CORS, and rate limiting. Because they are just route functions, they compose naturally with the rest of your routing and can be scoped to any path prefix.

## Static file serving

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

### serve options

| Option | Default | Description |
|--------|---------|-------------|
| `cache` | `false` | Buffer all files at startup |
| `recursive` | `true` | Serve subdirectories |
| `doListing` | `false` | Generate HTML index for directories without an index file |
| `index` | `'index.html'` | Filename to serve as directory index |
| `noFilename` | `false` | Strip the filename from the route path (for single-file routes) |
| `maxBufferLength` | — | Maximum file size to buffer |

## CORS

**Cross-Origin Resource Sharing (CORS)** is a browser security mechanism that blocks JavaScript on one origin (e.g. `https://my-app.com`) from calling an API on a different origin (e.g. `https://api.example.com`). The server must include specific response headers to opt in to cross-origin requests; without them the browser silently rejects the response.

RestNio's `rnio.cors()` plugin handles all of this — `Access-Control-Allow-Origin`, preflight `OPTIONS` responses, credentials — with a single `router.use()` call.

```js
// Open API — allow any origin (no args)
router.use('/api**', rnio.cors());

// Locked down to one origin
router.use('/api**', rnio.cors({
  origin:           'https://my-app.com',
  allowCredentials: true,       // allow cookies / auth headers
  headers:          '*',        // echo Access-Control-Request-Headers, or list explicitly
  preflight:        true,       // handle OPTIONS preflight (default: true)
  maxAge:           86400       // cache preflight response for 24 h
}));
```

CORS routes are registered with `isActive: false` — they set response headers but do not satisfy the "route responded" check, so the actual handler still runs after them. See [Default Routes](Default-Routes) for more on `isActive`.

## Rate limiting

`rnio.ratelimit()` protects routes from abuse by tracking request counts per configurable key and rejecting clients that exceed the limit within a sliding window.

**Time values** accept a plain number (milliseconds) or a human-readable [zeit/ms](https://github.com/vercel/ms) string: `'500ms'`, `'30s'`, `'1m'`, `'2h'`, `'1d'`, etc.

```js
// 5 requests per minute per IP
router.use('/login', rnio.ratelimit({
  per:     'address',   // 'address' (default) | 'route' | 'params'
  scope:   'hard',      // 'hard' (default) = whole scope counts; 'soft' = per exact path
  limit:   5,
  time:    '1m',        // also accepts: 60000 (ms), '60s', '1 minute'
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

### ratelimit options

| Option | Default | Description |
|--------|---------|-------------|
| `per` | `'address'` | Key strategy: `'address'`, `'route'`, or `'params'` |
| `perParams` | — | Parameter names to key by when `per: 'params'` |
| `customPer` | — | `(params, client) => string` for a fully custom key |
| `scope` | `'hard'` | `'hard'` = whole `use()` scope; `'soft'` = per exact path |
| `limit` | `60` | Max requests per `time` window |
| `time` | `'1m'` | Window size (zeit/ms string or ms number) |
| `message` | — | Custom error message |
| `code` | `429` | HTTP status code on limit exceeded |
| `headers` | `true` | Send `x-ratelimit-*` headers |
| `skip` | — | `(params, client) => bool` — skip rate limiting for matching requests |
| `skipOnMissingParams` | `false` | Skip if the `perParams` key is absent |

---

*[← Codec Negotiation](Codecs) | [Outbound Connectors →](Connectors)*
