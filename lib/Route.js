class Route {

    constructor(func, params = [], permissions = []) {
        this.func = func;
        this.params = params;
        this.permissions = permissions;
    }

}
module.exports = Route;