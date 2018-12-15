require('../../../../lib/routes/Router');
const rnio = require('../../../../index');
const $f = rnio.params.formatters;
const $c = rnio.params.checks;

module.exports = (router) => {

    router.all('/kick', (params, client) => {
        if (params.hard) {
            return "AAAAAAUUUWUUUWWWWWWUWUUW!!!!";
        } else {
            return "AUW WOOF!";
        }
    }, { 
        hard: {
            required: true, 
            type: 'boolean',
            checks: [
                (value, name, reject) => {
                    if (value === true) {
                        reject('You may not kick the dog in such a ' + name + ' a way!');
                    }
                }
            ]
        }
    },
    ['dogs.tekkel.schop.$hard', 'animals.bystander']);

    router.get('/meep', {
        paramdefs: {
            hard: {
                required: true,
                type: 'boolean'
            }
        },
        permissions: [
            'dog.meep'
        ],
        func: (params) => {
            return params.hard;
        }
    });

    router.get('/cuddle', (params) => {
        return "Cuddled tekkel " + params.times + " times!";
    }, {times: {required: true, type: 'number', prechecks: [$c.num.min(1)], formatters: [$f.num.add(2)], checks: [$c.num.max(5)]}});

    router.get('/feed', (params, client) => {
        client.json({eaten: true});
    });

    return router;
}