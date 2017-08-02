'use strict';

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var Sequelize = require('sequelize');

function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function getPrimaryKeys(model) {

    var primaryKeys = [];

    for (var p in model.attributes) {

        var attr = model.attributes[p];

        if (attr.primaryKey) primaryKeys.push(p);
    }

    return primaryKeys;
}

function cloneAttrs(model) {
    return Object.keys(model.attributes).map(function (attr) {
        return _defineProperty({}, attr, Object.assign({}, model.attributes[attr]));
    }).reduce(function (a, b) {
        return Object.assign(a, b);
    });
}

var VersionType = {
    CREATE: 1,
    UPDATE: 2,
    DELETE: 3
};

var defaults = {
    prefix: 'version'
};

var hooks = ['afterCreate', 'afterUpdate', 'afterSave', 'afterDestroy'];

function Version(model, customOptions) {
    var _versionAttrs;

    var options = Object.assign({}, Version.defaults, customOptions);

    var prefix = options.prefix;

    var versionModelName = '' + capitalize(prefix) + capitalize(model.name);

    var primaryKeys = getPrimaryKeys(model);

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

    var cloneModelAttrs = cloneAttrs(model);

    var versionModelAttrs = Object.assign({}, cloneModelAttrs, versionAttrs);

    primaryKeys.forEach(function (pk) {
        delete versionModelAttrs[pk].autoIncrement;
        delete versionModelAttrs[pk].primaryKey;
    });

    var tableName = prefix.toLowerCase() + '_' + (model.options.tableName || model.name.toLowerCase());

    var versionModelOptions = {
        schema: model.options.schema,
        tableName: tableName
    };

    var versionModel = model.sequelize.define(versionModelName, versionModelAttrs, versionModelOptions);

    hooks.forEach(function (hook) {

        model.addHook(hook, function (instanceData) {

            var versionType = VersionType.CREATE;

            switch (hook) {
                case 'afterUpdate':case 'afterSave':
                    versionType = VersionType.UPDATE;
                    break;
                case 'afterDestroy':
                    versionType = VersionType.DELETE;
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
