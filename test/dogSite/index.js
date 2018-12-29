module.exports = (router, rnio) => {
    router.get('/', (params, client) => {
        return 'INDEX OF DOGSITE!';
    });

    router.get('/do', () => {
        return 'YOU DID IT!';
    }, {}, ['do.do']);

    router.all('/token', {
        func: () => {
            return rnio.token.sign({permissions: '*'});
        }
    });

    router.all('/check', {
        params: {
            token: {
                required: true,
                type: 'string'
            }
        }, func: (params) => {
            return rnio.token.verify(params.token);
        }
    });

    router.use('/dogs', require('./dogs'));
    router.copy('/dogs', '/dogs/');
    return router;
};