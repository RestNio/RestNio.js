module.exports = (router) => {
    router.all('/schop', (params, client) => {
        // TODO: Parsing boolean params properly.
        if (params.hard) {
            return "AAAAAAUUUWUUUWWWWWWUWUUW!!!!";
            // runLater(getFromDatabase, (result) => {
            //     client.end(JSON.stringify(result));
            // });
            // return Infinity;
            // return new Promise((resolve, reject) => {
            //      let jan = getFromDB();
            //      resolve(jan);   
            // }
        } else {
            return "AUW WOOF!";
        }
    },
    { 
        hard: {
            required: true, 
            type: 'boolean',
            checks: [
                (value, reject) => {
                    if (value) {
                        reject('You may not kick the dog in such a way!');
                    }
                }
            ]
        }
    },
    ['dogs.tekkel.schop.$hard', 'animals.bystander']);
    // router.get('/give', (params) => {

    // });
    return router;
}