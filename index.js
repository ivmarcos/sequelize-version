'use strict';

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var Sequelize = require('sequelize');

function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function cloneAttrs(model, attrs) {

    var clone = {};

    var attributes = model.attributes;

    if (typeof attributes === 'string' || typeof attributes === 'function') return attributes;

    for (var p in attributes) {

        var nestedClone = {};

        var attribute = attributes[p];

        for (var np in attribute) {
            if (attrs.indexOf(np) > -1) {
                nestedClone[np] = attribute[np];
            }
        }

        clone[p] = nestedClone;
    }

    return clone;
}

var VersionType = {
    CREATED: 1,
    UPDATED: 2,
    DELETED: 3
};

var defaults = {
    prefix: 'version',
    suffix: ''
};

var hooks = ['afterUpdate', 'afterCreate', 'afterDestroy'];
var attrsToClone = ['type', 'field'];

function Version(model, customOptions) {
    var _versionAttrs;

    var options = Object.assign({}, Version.defaults, customOptions);

    var prefix = options.prefix;
    var suffix = options.suffix;

    var versionModelName = '' + capitalize(prefix) + capitalize(model.name);

    //const primaryKeys = getPrimaryKeys(model);

    var versionAttrs = (_versionAttrs = {}, _defineProperty(_versionAttrs, prefix + '_id', {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true
    }), _defineProperty(_versionAttrs, prefix + '_type', {
        type: Sequelize.INTEGER
    }), _defineProperty(_versionAttrs, prefix + '_timestamp', {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
    }), _versionAttrs);

    var cloneModelAttrs = cloneAttrs(model, attrsToClone);

    var versionModelAttrs = Object.assign({}, cloneModelAttrs, versionAttrs);

    var tableName = prefix.toLowerCase() + '_' + (model.options.tableName || model.name.toLowerCase()) + (suffix ? '_' + suffix : '');

    var versionModelOptions = {
        schema: options.schema || model.options.schema,
        tableName: tableName
    };

    var versionModel = model.sequelize.define(versionModelName, versionModelAttrs, versionModelOptions);

    hooks.forEach(function (hook) {

        model.addHook(hook, function (instanceData) {

            var versionType = VersionType.CREATED;

            switch (hook) {
                case 'afterUpdate':
                    versionType = VersionType.UPDATED;
                    break;
                case 'afterDestroy':
                    versionType = VersionType.DELETED;
                    break;
            }

            var data = JSON.parse(JSON.stringify(instanceData));

            var versionData = Object.assign({}, data, _defineProperty({}, prefix + '_type', versionType));

            return versionModel.build(versionData).save();
        });
    });

    return versionModel;
}

Version.defaults = defaults;
Version.VersionType = VersionType;

module.exports = Version;
