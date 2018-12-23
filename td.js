let permission = 'test.dogs.tekkel.cuddle'; //required
let holder = [
    '*'
    //'test.dogs.tekkel.*',
    //'test.dogs.tekkel.*'
];
let permissionX = permission.split('.');

for(let perm of holder) {
    let permX = perm.split('.');
    for (let i = permX.length - 1; i >= 0; i--) {
        if (permX[i] !== '*') {
            if (permX[i] !== permissionX[i]) {
                console.log('PERMISSION DENIED: ' + permX[i] + ' !== ' + permissionX[i]);
                return;
            }
        }
    }
    console.log('PERMISSION GRANTED!')
    return;
};


