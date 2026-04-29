# Outbound Connectors

RestNio ships HTTP and WebSocket **client** implementations that mirror the same interface you use on the server side. This is useful when a server needs to fan out requests to downstream services, proxy calls to another RestNio instance, or act as a participant in a wider microservice mesh — without reaching for a separate HTTP client library.

Both connectors use the same route-envelope conventions as the server, so talking to another RestNio service feels natural: you send `{ path, params }` objects and receive the same structured responses.

## One-shot HTTP request

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

`RestNio.request(method, url, params?, headers?, callback, json?)`

## HTTP connector (reusable client)

```js
const api = new RestNio.http('http://api.example.com', {
  token: 'jwt-here'       // included as a header in every request
}, true /* JSON mode */);

api.get(    { path: '/items' },                         (body) => console.log(body));
api.post(   { path: '/items', params: { name: 'x' } }, (body) => console.log(body));
api.put(    { path: '/items/1', params: { name: 'y' } }, (body) => console.log(body));
api.delete( { path: '/items/1' },                       (body) => console.log(body));
```

Available methods: `.get`, `.post`, `.put`, `.patch`, `.delete`, `.options`, `.trace`, `.request(method, req, cb)`.

## WebSocket connector client

```js
const ws = RestNio.websocket(
  'ws://localhost:7070',
  (data)         => console.log('received:', data),          // onMessage (pre-parsed)
  (data, client) => {                                         // onConnect
    client.obj({ path: '/join', params: { room: 'main' } });
  },
  ()             => console.log('disconnected'),             // onClose
  (err)          => console.error('error:', err)             // onError
);

// Send an envelope at any time
ws.obj({ path: '/chat', params: { text: 'hello' } });
ws.str('raw text');
ws.bin(Buffer.from([1, 2, 3]));
```

`RestNio.websocket(url, onMessage, onConnect, onClose, onError, timeout?, extra?)`

## Server-to-server links

For *persistent* peer connections between two RestNio servers (e.g. an edge
turbine controller uplinking to a park-level coordinator), see
**[Interconnect](Interconnect)**. It builds on top of the websocket
transport but adds reconnect, peer-scoped route isolation, and an
`rnio.inter('name')` registry so multiple peers can be addressed by name.

---

*[← Default Routes](Default-Routes) | [Interconnect →](Interconnect)*
