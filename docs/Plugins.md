# Built-in Plugins

Plugins are router functions — mount them with `router.use()`.

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

```js
// Open API — allow all origins
router.use('/api**', rnio.cors());

// Restricted to one origin
router.use('/api**', rnio.cors({
  origin:           'https://example.com',
  allowCredentials: true,
  headers:          '*',    // echo Access-Control-Request-Headers, or list explicitly
  preflight:        true,   // handle OPTIONS preflight (default: true)
  maxAge:           86400   // cache preflight response for 24 h
}));
```

CORS routes are registered with `isActive: false` — they set headers but do not satisfy the "responded" check, so subsequent route handlers still run. See [Default Routes](Default-Routes) for more on `isActive`.

## Rate limiting

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
