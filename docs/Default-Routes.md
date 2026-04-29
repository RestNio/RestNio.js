# Default Routes You Can Override

These route keys are pre-registered and can be replaced via `router.on()` or `options.default.routes`:

| Key | When it fires | Default behavior |
|-----|---------------|-----------------|
| `'404'` | No route matched | `throw [404, 'page not found']` |
| `'403'` | Permission check failed | `throw [403, 'permission error']` |
| `'500'` | Unhandled exception | `throw [500, 'internal server error']` |
| `'wsConnect'` | WebSocket client connects | no-op (no MOTD) |
| `'wsClose'` | WebSocket client disconnects | no-op |
| `'wsBin'` | Unhandled binary frame arrives | `throw [400, 'no binary handler active']` |
| `'interOpen'` | Outbound peer ([Interconnect](Interconnect)) reaches OPEN | no-op |
| `'interClose'` | Outbound peer socket closes | no-op |
| `'interFail'` | Outbound peer exhausts `reconnect.maxAttempts` | no-op |

## Override via `router.on()`

```js
router.on('wsConnect', () => ({ motd: 'hello!', version: '1.0' }));
router.on('404', (params, client) => { throw [404, 'nothing here']; });
router.on('500', (params, client) => {
  console.error('unhandled error', params);
  throw [500, 'something went wrong'];
});
```

## Override via constructor options

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

## Throwing errors from route handlers

```js
throw [404, 'not found'];   // client receives: { code: 404, error: 'not found' }
throw [400, 'bad input'];
throw [403, 'no access'];
throw [500, 'something broke'];
```

## isActive: false — middleware-style routes

Set `isActive: false` on routes that only set headers or perform side-effects and never send a response. They run but do not satisfy the "route responded" check, so subsequent route handlers still execute.

```js
router.httpAll('', {
  isActive: false,
  func: (params, client) => {
    client.header('access-control-allow-origin', '*');
  }
});
```

This is exactly how the built-in [CORS plugin](Plugins) works internally.

---

*[← Plugins](Plugins) | [Outbound Connectors →](Connectors)*
