# HTTP Behavior and Client Helpers

## Response types by return value

| Return value | HTTP behavior |
|---|---|
| `string` | `200` plain text, `content-type: text/plain` |
| `object` | `200` JSON, `content-type: application/json` |
| `Buffer` | `200` binary, `content-type: application/octet-stream` |
| `Infinity` | No automatic response — handler controls the connection |
| `undefined` (no return) | Fall through to next matching route; `200 OK` if nothing else responded |

## Taking manual control

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

## Reading request information

```js
client.ip          // remote IP string or null
client.headers     // raw request headers (plain object)
client.cookies     // parsed cookie map — HTTP only
client.type        // 'http' or 'ws'
client.state       // app-owned free-form bag; RestNio never touches it
```

## Cookies (HTTP only)

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

## Setting response headers

```js
router.get('/data', (params, client) => {
  client.header('x-request-id', '12345');
  return { data: true };
});
```

## HTTP status codes

Throw an array `[code, message]` from any handler to return an error response:

```js
throw [404, 'not found'];   // → { code: 404, error: 'not found' }
throw [400, 'bad input'];
throw [403, 'no access'];
throw [500, 'something broke'];
```

The built-in [Default Routes](Default-Routes) handle unmatched routes, permission failures, and uncaught exceptions.

---

*[← Params & Validation](Params) | [Auth & Permissions →](Auth)*
