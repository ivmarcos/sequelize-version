'use strict';

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var Sequelize = require('sequelize');

function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function cloneAttrs(model, attrs) {

    var clone = {};

    var attributes = model.attributes;

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

var hooks = ['afterCreate', 'afterUpdate', 'afterDestroy'];
var attrsToClone = ['type', 'field'];

function getVersionType(hook) {
    if (hook === 'afterCreate') return VersionType.CREATED;
    if (hook === 'afterUpdate') return VersionType.UPDATED;
    if (hook === 'afterDestroy') return VersionType.DELETED;
}

function Version(model, customOptions) {
    var _versionAttrs;

    var options = Object.assign({}, Version.defaults, customOptions);

    var prefix = options.prefix;
    var suffix = options.suffix;

    var versionModelName = '' + capitalize(prefix) + capitalize(model.name);

    var versionFieldId = prefix + '_id';
    var versionFieldType = prefix + '_type';
    var versionFieldTimestamp = prefix + '_timestamp';

    var versionAttrs = (_versionAttrs = {}, _defineProperty(_versionAttrs, versionFieldId, {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true
    }), _defineProperty(_versionAttrs, versionFieldType, {
        type: Sequelize.INTEGER,
        allowNull: false
    }), _defineProperty(_versionAttrs, versionFieldTimestamp, {
        type: Sequelize.DATE,
        allowNull: false
    }), _versionAttrs);

    var cloneModelAttrs = cloneAttrs(model, attrsToClone);
    var versionModelAttrs = Object.assign({}, cloneModelAttrs, versionAttrs);
    var tableName = prefix.toLowerCase() + '_' + (model.options.tableName || model.name.toLowerCase()) + (suffix ? '_' + suffix : '');

    var versionModelOptions = {
        schema: options.schema || model.options.schema,
        tableName: tableName,
        timestamps: false
    };

    var versionModel = model.sequelize.define(versionModelName, versionModelAttrs, versionModelOptions);

    hooks.forEach(function (hook) {

        model.addHook(hook, function (instanceData) {
            var _Object$assign;

            var versionType = getVersionType(hook);

            var data = JSON.parse(JSON.stringify(instanceData));

            var versionData = Object.assign({}, data, (_Object$assign = {}, _defineProperty(_Object$assign, versionFieldType, versionType), _defineProperty(_Object$assign, versionFieldTimestamp, new Date()), _Object$assign));

            return versionModel.build(versionData).save();
        });
    });

    return versionModel;
}

Version.defaults = defaults;
Version.VersionType = VersionType;

module.exports = Version;
