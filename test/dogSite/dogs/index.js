module.exports = (router) => {
    router.get('/get', (params, client) => {
        console.log('WOOF!');
    });
    return router;
};