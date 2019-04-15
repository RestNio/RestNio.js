const RestNio = require('restnio');
const Dog = require('./dog');

let dogSite = new RestNio((router, restnio) => {

    router.get('/', () => 'INDEX OF DOGSITE'); // Als je naar de website gaat krijg je deze indexpagina.

    router.redirect('/index.html', '/'); // Redirect standaard index naar de root.

    router.use(restnio.serve('./README.md')); // Dien de statische pagina README.md op /README.md

    // Wanneer naar /gettoken genavigeert wordt, wordt een ondertekende token gegeven die voor bepaalde tijd
    // toegang verleent tot de rechten: dog.claim en dog.feed.fido.
    router.get('/gettoken', () => restnio.token.sign({permissions: ['dog.claim', 'dog.feed.fido']}));

    router.post('/claimdog', {
        // Voor de claimdog functie wordt uitgevoerd wordt eerst gekeken of
        // alle parameters aanwezig zijn en aan de eisen (checks) voldoen.
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
        // Om een dog te claimen moet je bepaalde rechten hebben.
        // In dit geval voldoet een simpele 'dog.claim'
        // RestNio geeft dit recht aan een HTTP request met een geldige token.
        // Die token wordt automatisch geverivieerd met de auth opties.
        permissions: [
            'dog.claim'
        ],
        // Als je alle rechten hebt, en de parameters voldoen, dan wordt
        // deze functie uitgevoerd. De hond wordt in de database gezet.
        func: (params) => {
            // Een dog wordt in bookshelf (database model) normaal gesproken
            // aangemaakt met een name en een age. Aangezien deze parameters
            // exact overeenkomen met restnio kunnen we heel makkelijk een hond aanmaken.
            return new Dog(params).save();
        }
    });

    // GET, POST, All staat alle HTTP request types toe.
    // Parameters kunnen via post-body of get-url worden meegegeven,
    // ze kunnen echter ook in de URL verwerkt zitten.
    router.all('/dog/$name/feed', {
        // In dit geval moet je het recht hebben om de hond met de naam
        // die je eten wil geven, eten te geven.
        permissions: ['dog.feed.$name'],
        func: (params) => {
            // Ook hier komen de params overeen. Een hond waar de naam
            // overeenkomt wordt opgevraagd en dan wordt er eten gegeven.
            Dog.where(params).fetch().then(dog => dog.feed());
            // Bij mogelijke foutmeldingen worden deze nu direct naar de 
            // eind-gebruiker doorgesuist. Je zou ook errors kunnen afhandelen.
        }
    });

    // Nog een simpel voorbeeld met URL parameter.
    router.all('/$name/hi', (params) => {
        return `${params.name} is een aardig persoon.`;
    });

    // Je kunt routers 'nestelen'.
    // Zo kan je delen van de API in verschillende bestanden makkelijk afsplitsen.
    router.use('/derp', (router) => {
        // De / verwijst in dit geval naar /derp/
        router.get('/', () => 'derpindex');
        // De /name verwijst in dit geval naar /derp/name
        router.get('/name', () => 'kasper');
    }, true);

}, {
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