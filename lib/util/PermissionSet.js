/*
 *   -= RestNio =-
 *  Made by 7kasper
 * Licensed under MIT
 *   -= RestNio =-
 */

'use strict';

const jsUtils = require('./jsUtils');

/**
 * @class PermissionSet
 * @author 7kasper
 * @classdesc
 * Special set implementation for permissions.
 * Permissions are stored internally as a string set.
 * This class provides many helper functions to check
 * and insert or delete permissions with wildcard capability 
 * and the like. Most set functions are overridden to
 * provide an easy to use permission system.
 */
class PermissionSet extends Set {

    /**
     * Adds permissions in the way described in `upgradeAll()`.
     * @param {...any} args The permissions to upgrade to.
     * Can be either a spread out list of
     * permissions or an iterable object containing full string permissions.
     * @throws Exception if any permission given is not a valid string. 
     */
    add(...args) {
        this.upgradeAll(...args);
    }

    /**
     * Adds permissions in the way described in `upgradeAll()`.
     * @param {...any} args The permissions to upgrade to.
     * Can be either a spread out list of
     * permissions or an iterable object containing full string permissions.
     * @throws Exception if any permission given is not a valid string. 
     */
    grant(...args) {
        this.upgradeAll(...args);
    }

    /**
     * Deletes permission in the way described in `deleteAll()`.
     * @param {...any} args The permissions to delete.
     * Can be either a spread out list of
     * permissions or an iterable object containing full string permissions.
     * @throws Exception if any permission given is not a valid string. 
     */
    revoke(...args) {
        this.deleteAll(...args);
    }

    /**
     * Adds all permissions specified and upgrades the set to contain no
     * lesser permissions of those specified. (For optimisation purposes)
     * @param {...any} args The permissions to upgrade to.
     * Can be either a spread out list of
     * permissions or an iterable object containing full string permissions.
     * @throws Exception if any permission given is not a valid string. 
     */
    upgradeAll(...args) {
        let permissions = (PermissionSet.isArrayLike(args[0])) ? args[0] : args;
        permissions.forEach(permission => {
            this.upgrade(permission);
        });
    }

    /**
     * Adds specified permission and skims off any lesser permissions in this set.
     * (For optimisation purposes)
     * @param {string} permission - The permission to upgrade to.
     * @throws Exception the permission given is not a valid string.
     */
    upgrade(permission) {
        if (typeof permission !== 'string') throw 'Permission ' + permission + ' is not a string!';
        let permissionSplit = permission.split('.');
        for (let thisPerm of this) {
            let thisPermSplit = thisPerm.split('.');
            // If a superior permission is already present, skip adding.
            if (PermissionSet.checkPermission(thisPermSplit, permissionSplit)) {
                return;
            }
            // If lesser permissions are in the set, remove them for optimisation.
            if (PermissionSet.checkPermission(permissionSplit, thisPermSplit)) {
                this.delete(thisPerm);
            }
            super.add(permission);
        }
    }

    /**
     * Adds all permissions specified and downgrades the set to contain no
     * superior permissions of those specified.
     * @param {...any} args The permissions to downgrade to.
     * Can be either a spread out list of
     * permissions or an iterable object containing full string permissions.
     * @throws Exception if any permission given is not a valid string. 
     */
    downgradeAll(...args) {
        let permissions = (PermissionSet.isArrayLike(args[0])) ? args[0] : args;
        permissions.forEach(permission => {
            this.downgrade(permission);
        });
    }

    /**
     * Adds specified permission and skims off any superior or lesser permissions in this set.
     * @param {string} permission - The permission to downgrade to.
     * @throws Exception the permission given is not a valid string.
     */
    downgrade(permission) {
        let permissionSplit = PermissionSet.formatPermission(permission);
        for (let thisPerm of this) {
            let thisPermSplit = thisPerm.split('.');
            // If a superior permission is present, remove it from set.
            if (PermissionSet.checkPermission(thisPermSplit, permissionSplit)) {
                super.delete(thisPerm);
            }
            // If a lesser permission is present, also remove it.
            if (PermissionSet.checkPermission(permissionSplit, thisPermSplit)) {
                super.delete(thisPerm);
            }
            super.add(permission);
        }
    }


    /**
     * Deletes only a single full-matching permission from the list.
     * Example: `delete('dogs.*.kick')` would remove `dogs.*.kick` but not `dogs.tekkel.kick`
     * @param {*} permission the permission to remove.
     */
    deleteMatch(permission) {
        super.delete(permission);
    }

     /**
     * Removes all specified and all permissions falling under those from the set.  
     * Example: `delete('dogs.*.kick')` would remove `dogs.*.kick` but also `dogs.tekkel.kick`
     * Also `delete('*')` is effectively the same as `clear()`
     * but not `dogs.tekkel.kick` or `dogs.*.kick.hard` 
     * @param {...any} args - The permissions to delete. 
     * Can be either a spread out list of
     * permissions or an iterable object containing full string permissions.
     * @throws Exception if any permission given is not a valid string.
     */
    deleteAll(...args) {
        let permissions = (PermissionSet.isArrayLike(args[0])) ? args[0] : args;
        permissions.forEach(permission => {
            this.delete(permission);
        });
    }

    /**
     * Removes specified and all permissions falling under it from the set.  
     * Example: `delete('dogs.*.kick')` would remove `dogs.*.kick` but also `dogs.tekkel.kick`
     * Also `delete('*')` is effectively the same as `clear()`
     * but not `dogs.tekkel.kick` or `dogs.*.kick.hard` 
     * @param {string} permission - The Permission to chain delete from.
     * @throws Exception if any permission given is not a valid string.
     */
    delete(permission) {
        permission = PermissionSet.formatPermission(permission);
        for (let thisPerm of this) {
            // If a permission falls under this permission, remove it from set.
            if (PermissionSet.checkPermission(permissionSplit, thisPerm.split('.'))) {
                super.delete(thisPerm);
            }
        }
    }

    /**
     * Removes all superiors containing specified permission from the set.  
     * Example: `delete('dogs.*.kick')` would remove `dogs.*.kick` and `*.*.kick`
     * but not `dogs.tekkel.kick` or `dogs.*.kick.hard` 
     * @param {string} permission - The Permission to chain delete from.
     * @throws Exception the permission given is not a valid string.
     */
    deleteSuperiors(permission) {
        permission = PermissionSet.formatPermission(permission);
        for (let thisPerm of this) {
            // If this permission falls under a permission from the set, remove it from set.
            if (PermissionSet.checkPermission(thisPerm.split('.'), permissionSplit)) {
                super.delete(thisPerm);
            }
        }
    }

    /**
     * Checks if the set grants access to all permissions specified.
     * @param {...any} args Can be either a spread out list of
     * permissions or an iterable object containing full string permissions.
     * @returns true, if all permissions are granted.
     * @throws Exception if any permission given is not a valid string. 
     */
    hasAll(...args) {
        let permissions = (PermissionSet.isArrayLike(args[0])) ? args[0] : args;
        for (let permission of permissions) {
            if (!this.has(permission)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Checks if the set grants access to a certain permission.
     * @param {string} permission - The permission to check (string format)
     * @returns true, if the permission is granted.
     * @throws Exception if the permission given is not a valid string.
     */
    has(permission) {
        permission = PermissionSet.formatPermission(permission);
        for (let thisPerm of this) {
            if (PermissionSet.checkPermission(thisPerm.split('.'), permission)) {
                return true;
            }
        }
        return false;
    }

    //=====================================================\\
    //				          Utils		          		   \\
    //=====================================================\\

    /**
     * Formats a permission to the internal (array) format.
     * This method only accepts strings (the outside format).
     * @param {string} permission - The permission to format.
     * @returns the permission in internal format.
     * @throws Exception if permission given is not a valid string. 
     */
    static formatPermission(permission) {
        if (typeof permission !== 'string') throw 'Permission ' + permission + ' is not a string!';
        return permission.split('.');
    }

    /**
     * Checks if `thisPerm` grants access to the permission `checkPerm`.
     * @param {string[]} thisPerm - The permission to check with, in split array format.
     * @param {string[]} checkPerm - The permission to check for, in split array format.
     * @returns true, if `checkPerm` is granted by `thisPerm`.
     */
    static checkPermission(thisPerm, checkPerm) {
        for (let i = thisPerm.length - 1 ; i >= 0; i--) {
            if (thisPerm[i] !== '*' && thisPerm[i] !== checkPerm[i]) {
                return false;
            }
        }
        return true;
    }

    /**
     * Checks wether an object is iteratable.
     * @param {any} obj 
     * @returns true, if object is itertable.
     */
    static isIterable(obj) {
        if (obj == null) return false;
        return typeof obj[Symbol.iterator] === 'function';
    }

    /**
     * Checks wether an object is similar to array.
     * Basically this means an object is iteratable
     * but not a string.
     * @param {any} obj
     * @returns true, if an object looks or is like an array.  
     */
    static isArrayLike(obj) {
        if (typeof obj === 'string') return false;
        return PermissionSet.isIterable(obj);
    }

}
module.exports = PermissionSet;