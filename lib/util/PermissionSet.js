class PermissionSet extends Set {

    addAll(...args) {
        let permissions = (Array.isArray(args[0])) ?  args[0] : args;
        permissions.forEach(permission => {
            this.add(permission);
        });
    }

    add(permission) {
        if (typeof permission === 'string') {
            return super.add(permission);
        } else {
            throw 'Permission ' + permission + ' is not a string!';
        }
    }

    has(permission) {
        permission = permission.split('.');
        for (let thisPerm of this) {
            if (PermissionSet.checkPermission(thisPerm.split('.'), permission)) {
                return true;
            }
        }
        return false;
    }

    static checkPermission(thisPerm, checkPerm) {
        for (let i = thisPerm.length - 1 ; i >= 0; i--) {
            if (thisPerm[i] !== '*' && thisPerm[i] !== checkPerm[i]) {
                return false;
            }
        }
        return true;
    }

}
module.exports = PermissionSet;