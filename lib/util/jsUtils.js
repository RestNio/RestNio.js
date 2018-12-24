
class jsUtils {

    static isIterable(obj) {
        if (obj == null) return false;
        return typeof obj[Symbol.iterator] === 'function';
    }

    static isArrayLike(obj) {
        if (typeof obj === 'string') return false;
        return jsUtils.isIterable(obj);
    }

}
module.exports = jsUtils;