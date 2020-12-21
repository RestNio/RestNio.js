
const readline = require('readline');
// const rl = readline.createInterface({input: process.stdin, output: process.stdout, prompt: 'Chat>'});

const RestNio = require('../');
// RestNio.request('POST', 'http://127.0.0.1:7070/test?age=2', {name: 1}, (body, res) => {
//     console.log(body);
// });

let http = new RestNio.http('http://127.0.0.1:7070');
http.get({
    path: '/test',
    params: {
        age: 'test'
    }
}, (res => console.log(res)));

// RestNio.http('GET', 'http://mu1.nl/', (body) => console.log(body));

// let ws = RestNio.websocket('ws://localhost:7070/', (data) => console.log(data), (data, client) => {
//     console.log('connected');
//     client.obj({
//         path: '/join',
//         params: {
//             room: 'test1',
//             name: 'nodejs'
//         }
//     });
// }, ()=>{console.log('CLOSED CLIENT')});

// rl.prompt();
// rl.on("line", (msg) => {
//     ws.obj({
//         path: '/chat',
//         params: {
//             msg: msg.trim()
//         }
//     });
//     rl.prompt();
// });
// rl.on('close', () => {
//     ws.terminate();
// });