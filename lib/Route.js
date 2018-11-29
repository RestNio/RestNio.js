class Route {

    constructor(path, params, permissions, func) {
        this.path = path;
        this.params = params;
        this.permissions = permissions;
        this.func = func;
    }

}
module.exports = Route;