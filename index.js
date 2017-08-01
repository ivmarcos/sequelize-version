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

var defaultOptions = {
    prefix: 'version'
};

module.exports = function (model, customOptions) {
    var _versionExclusiveAttr;

    var options = Object.assign({}, defaultOptions, customOptions);

    var prefix = options.prefix;

    var versionModelName = '' + capitalize(prefix) + capitalize(model.name);

    var primaryKeys = getPrimaryKeys(model);

    var versionExclusiveAttrs = (_versionExclusiveAttr = {}, _defineProperty(_versionExclusiveAttr, prefix + '_id', {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true
    }), _defineProperty(_versionExclusiveAttr, prefix + 'Type_id', {
        type: Sequelize.INTEGER
    }), _versionExclusiveAttr);

    var versionModelAttrs = Object.assign({}, model.attributes, versionExclusiveAttrs);

    primaryKeys.forEach(function (pk) {
        versionModelAttrs[pk].autoIncrement = false;
    });

    var tableName = prefix.toLowerCase() + '_' + model.options.tableName;

    var versionModelOptions = {
        schema: model.options.schema,
        tableName: tableName
    };

    var versionModel = model.sequelize.define(versionModelName, versionModelAttrs, versionModelOptions);

    var hooks = ['afterCreate', 'afterUpdate', 'afterSave', 'afterDestroy'];

    var VersionType = {
        CREATE: 1,
        UPDATE: 2,
        DELETE: 3
    };

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

            var versionData = Object.assign({}, data, _defineProperty({}, prefix + 'Type_id', versionType));

            return versionModel.build(versionData).save();
        });
    });

    versionModel.VersionType = VersionType;

    return versionModel;
};
