

function bakeRegex(str) {
    str = str.replace(/\*/g, '\\w*');
    let rex = /\$([a-zA-Z_$][0-9a-zA-Z_$]*)/g;
    let match = rex.exec(str);
    while(match != null) {
      console.log(match);
      str = str.replace(match[0], `(?<${match[1]}>\\w*)`);
      match = rex.exec(str);
    }
    return new RegExp(str);
  }




// console.log(require('./lib/util/jsUtils').isIterable(true));
// const caller = require('caller-callsite');
// console.log(caller().getFileName());

// var re = /\$([^.]+)/g;
// var s = 'dogs.$tekkel.kick.$meep';

// console.log(s.replace(re, (match, g1) => {
//     console.log(match, g1);
//     return 'yes';
// }));

// let permission = 'test.dogs.tekkel.cuddle'; //required
// let holder = [
//     '*'
//     //'test.dogs.tekkel.*',
//     //'test.dogs.tekkel.*'
// ];
// let permissionX = permission.split('.');

// for(let perm of holder) {
//     let permX = perm.split('.');
//     for (let i = permX.length - 1; i >= 0; i--) {
//         if (permX[i] !== '*') {
//             if (permX[i] !== permissionX[i]) {
//                 console.log('PERMISSION DENIED: ' + permX[i] + ' !== ' + permissionX[i]);
//                 return;
//             }
//         }
//     }
//     console.log('PERMISSION GRANTED!')
//     return;
// };


