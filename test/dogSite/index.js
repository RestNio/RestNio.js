module.exports = (router) => {
    router.get('/', (params, client) => {
        console.log('INDEX OF DOGSITE!');
    });
    router.use('/dogs', require('./dogs'));
    router.copy('/dogs', '/dogs/');
    return router;
};