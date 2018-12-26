require('../../../../lib/routes/Router');
const rnio = require('../../../../index');
const $p = rnio.params;
const $f = $p.formatters;
const $c = $p.checks;

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
        params: {
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

    router.all('/email', (params) => {
        return "Sending email to dog from: " + params.mail;
    }, {mail:$p.email});

    router.get('/cuddle', (params) => {
        return "Cuddled tekkel " + params.times + " times!";
    }, {times: {required: true, type: 'number', prechecks: [$c.num.min(1)], formatters: [$f.num.add(2)], checks: [$c.num.max(5)]}});

    router.get('/feed', (params, client) => {
        client.json({eaten: true});
    });

    return router;
}