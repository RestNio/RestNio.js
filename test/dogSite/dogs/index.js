module.exports = (router) => {
    router.all('/', (params, client) => {
        console.log('index of /dogs');
    });
    router.get('/get', (params, client) => {
        console.log('WOOF!');
    });
    return router;
};