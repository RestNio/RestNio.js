# Quick Start: Smallest Server

```bash
npm install restnio
```

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

The router callback receives `(router, rnio)`:

- `router` — register routes
- `rnio` — the RestNio instance (access to `rnio.params`, `rnio.token`, `rnio.subs()`, plugins)

## A slightly larger example

```js
const RestNio = require('restnio');

const app = new RestNio((router, rnio) => {

  // Plain text response
  router.get('/', () => 'RestNio is running');

  // JSON response with validated params
  router.post('/sum', {
    params: {
      a: rnio.params.number,
      b: rnio.params.number
    },
    func: ({ a, b }) => ({ result: a + b })
  });

  // Issue a JWT token
  router.get('/token', () => rnio.token.grant(['chat.send']));

  // WebSocket route (same syntax as HTTP)
  router.ws('/ping', () => ({ pong: true }));

}, { port: 7070 });

app.bind();
```

From here see [Routing](Routing) for the full routing model, or jump straight to the [Progressive Starter](Starter) for a complete annotated example.

---

*[Home](Home) | [Routing →](Routing)*
