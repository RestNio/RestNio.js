module.exports = (router) => {
    router.all('/', (params, client) => {
        return 'index of /dogs';
    });
    router.get('/get', (params, client) => {
        return 'WOOF!';
    });
    router.use('/tekkel', require('./tekkel'));
    return router;
};