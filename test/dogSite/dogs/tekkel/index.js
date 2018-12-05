module.exports = (router) => {
    router.all('/schop', (params, client) => {
        // TODO: Parsing boolean params properly.
        if (params.hard && params.hard !== 'false') {
            return "AAAAAAUUUWUUUWWWWWWUWUUW!!!!";
            // runLater(getFromDatabase, (result) => {
            //     client.end(JSON.stringify(result));
            // });
            // return Infinity;
        } else {
            return "AUW WOOF!";
        }
    }, [], 
    ['dogs.tekkel.schop.$hard', 'animals.breeder']);
    return router;
}