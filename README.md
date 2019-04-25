# RestNio.js
A powerful and easy to use http and websocket routing system for javascript.

## Example
-------------------
```javascript
const RestNio = require('restnio');
const Dog = require('./dog');

let dogSite = new RestNio((router, restnio) => {

    router.get('/', () => 'INDEX OF DOGSITE'); // If you go to the site you get this index.

    router.redirect('/index.html', '/'); // Redirect standard index to the root.

    router.use(restnio.serve('./README.md', {cache: true})); // Serve the static page README.md to /README.md (cached)

    router.use('/img', restnio.serve('C:/www/images/')); // Serve all images from folder to /img (not cached)

    // When you go to /gettoken a special token will be signed that gives the user permission to
    // the rights: dog.claim en dog.feed.fido, when sending the token in header, for the time specified.
    router.get('/gettoken', () => restnio.token.grant(['dog.claim', 'dog.feed.fido']));

    router.post('/claimdog', {
        // Before claimdog is executed, all parameter checks
        // will be executed.
        params: {
            name: {
                required: true,
                type: 'string'
            },
            age: {
                required: true,
                type: 'number',
                checks: [
                    restnio.params.checks.num.isInteger(), 
                    restnio.params.checks.num.min(0)
                ]
            }
        },
        // To claim a dog you need certain rights.
        // In this case a simple 'dog.claim' will do.
        // RestNio gives this right if the client send a valid token in the token header.
        permissions: [
            'dog.claim'
        ],
        // If the rights and the parameters check out, the routing function is executed.
        func: (params) => {
            // A new dog is created using (in this case) a bookshelf.js model.
            // A dog normally expects a name and an age. Since the parameters
            // are an exact match for bookshelf we can just pass them in.
            return new Dog(params).save();
        }
    });

    // GET, POST, All reacts to all HTTP request types.
    // Parameters can be given both in URL or using request / body parameters.
    router.all('/dog/:name/feed', {
        // In this case you need the specific right contianing the name of the
        // dog to feed it.
        permissions: ['dog.feed.:name'],
        func: (params) => {
            Dog.where(params).fetch().then(dog => dog.feed());
            // If an error is given it is directly send to the client.
            // You could handle custom errors.
        }
    });

    // Another simple  example using path params.
    router.all('/$name/hi', (params) =>  `${params.name} is een aardig persoon.`);

    // You can nest routers.
    // This also makes it easy to split routers in different files.
    router.use('/derp', (router) => {
        // The / is now pointing to /derp/
        router.get('/', () => 'derpindex');
        // The /name points to /derp/name
        router.get('/name', () => 'kasper');
    }, true);

}, {
    // Restnio options.
    port: 80, 
    auth: {
        type: 'jwt',
        algorithm: 'HS256',
        secret: 'dogshite',
        sign: {
            expiresIn: '1h',
            issuer: 'RestNio'
        },
        verify: {
            issuer: ['RestNio', '7kasper']
        }
    }
});
dogSite.bind();
```

### WIP
Although this project is almost ready for release, there is still work in progress.
Some functionality might change and documentation / tutorials are still missing.
Expect tutorials and missing documentation within a month or so.
