# A Progressive Starter You Can Extend

Copy this file and start from here. It demonstrates HTTP routes, params, auth, WebSocket messaging, subscriptions, and plugins in one self-contained example.

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

  // GET /token → returns a JWT with the 'chat.send' permission
  router.get('/token', () => rnio.token.grant(['chat.send']));

  router.post('/secure/ping', {
    permissions: ['chat.send'],
    func: () => ({ pong: true })
  });

  // ── WebSocket ─────────────────────────────────────────────────────────

  // Fires once per connecting client; return value sent as MOTD
  router.on('wsConnect', () => ({ motd: 'connected' }));

  // Subscribe the client to a named room; persist name in client.state
  router.ws('/join', (params, client) => {
    client.state.name = params.name || 'anonymous';
    client.subscribe(params.room || 'main');
    return { joined: params.room || 'main' };
  });

  // Broadcast a message to everyone in the room
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

  router.use('/public',   rnio.serve('./public/', { doListing: true }));
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

## Try it out

```bash
# Get a token
curl http://localhost:7070/token

# Use the token
curl -X POST -H "token: <jwt>" -H "content-type: application/json" \
     -d '{"a":3,"b":4}' http://localhost:7070/sum
# → {"result":7}

# WebSocket (wscat)
wscat -c ws://localhost:7070
> {"path":"/join","params":{"name":"alice","room":"main"}}
> {"path":"/chat","token":"<jwt>","params":{"text":"hi!","room":"main"}}
```

---

*[← TypeScript](TypeScript) | [Operational Notes →](Operations)*
