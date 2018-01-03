'use strict';

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var Sequelize = require('sequelize');

function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function toArray(value) {
    return Array.isArray(value) ? value : [value];
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function cloneAttrs(model, attrs, excludeAttrs) {

    var clone = {};

    var attributes = model.attributes;

    for (var p in attributes) {

        if (excludeAttrs.indexOf(p) > -1) continue;

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

function versionAttributes(options) {
    var _ref;

    var attributePrefix = options.attributePrefix || options.prefix;
    return _ref = {}, _defineProperty(_ref, attributePrefix + '_id', {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true
    }), _defineProperty(_ref, attributePrefix + '_type', {
        type: Sequelize.INTEGER,
        allowNull: false
    }), _defineProperty(_ref, attributePrefix + '_timestamp', {
        type: Sequelize.DATE,
        allowNull: false
    }), _ref;
}

var VersionType = {
    CREATED: 1,
    UPDATED: 2,
    DELETED: 3
};

var Hook = {
    AFTER_CREATE: 'afterCreate',
    AFTER_UPDATE: 'afterUpdate',
    AFTER_DESTROY: 'afterDestroy',
    AFTER_SAVE: 'afterSave',
    AFTER_BULK_CREATE: 'afterBulkCreate'
};
var defaults = {
    prefix: 'version',
    attributePrefix: '',
    suffix: '',
    schema: '',
    namespace: null,
    sequelize: null,
    exclude: [],
    versionAttributes: versionAttributes
};

var hooks = [Hook.AFTER_CREATE, Hook.AFTER_UPDATE, Hook.AFTER_BULK_CREATE, Hook.AFTER_DESTROY];

var attrsToClone = ['type', 'field'];

function getVersionType(hook) {
    switch (hook) {
        case Hook.AFTER_CREATE:case Hook.AFTER_BULK_CREATE:
            return VersionType.CREATED;
        case Hook.AFTER_UPDATE:
            return VersionType.UPDATED;
        case Hook.AFTER_DESTROY:
            return VersionType.DELETED;
    }
    throw new Error('Version type not found for hook ' + hook);
}

function Version(model, customOptions) {

    var options = Object.assign({}, defaults, Version.defaults, customOptions);

    var prefix = options.prefix;
    var suffix = options.suffix;
    var sequelize = options.sequelize || model.sequelize;
    var namespace = options.namespace;
    var excludeAttrs = options.exclude;
    var schema = options.schema || model.options.schema;
    var attributePrefix = options.attributePrefix || options.prefix;

    var versionModelName = '' + capitalize(prefix) + capitalize(model.name);

    var versionAttrs = typeof options.versionAttributes === 'function' ? options.versionAttributes(options) : options.versionAttributes;

    var cloneModelAttrs = cloneAttrs(model, attrsToClone, excludeAttrs);
    var versionModelAttrs = Object.assign({}, cloneModelAttrs, versionAttrs);
    var tableName = prefix + '_' + (model.options.tableName || model.name) + (suffix ? '_' + suffix : '');

    var versionFieldId = attributePrefix + '_id';
    var versionFieldType = attributePrefix + '_type';
    var versionFieldTimestamp = attributePrefix + '_timestamp';

    var versionModelOptions = {
        schema: schema,
        tableName: tableName,
        timestamps: false
    };

    var versionModel = sequelize.define(versionModelName, versionModelAttrs, versionModelOptions);

    hooks.forEach(function (hook) {

        model.addHook(hook, function (instanceData, _ref2) {
            var transaction = _ref2.transaction;


            var cls = namespace || Sequelize.cls;

            var versionTransaction = void 0;

            if (sequelize === model.sequelize) {
                versionTransaction = cls ? cls.get('transaction') || transaction : transaction;
            } else {
                versionTransaction = cls ? cls.get('transaction') : undefined;
            }

            var versionType = getVersionType(hook);

            var instancesData = toArray(instanceData);

            var versionData = instancesData.map(function (data) {
                var _Object$assign;

                return Object.assign({}, clone(data), (_Object$assign = {}, _defineProperty(_Object$assign, versionFieldType, versionType), _defineProperty(_Object$assign, versionFieldTimestamp, new Date()), _Object$assign));
            });

            return versionModel.bulkCreate(versionData, { transaction: versionTransaction });
        });
    });

    versionModel.addScope('created', { where: _defineProperty({}, versionFieldType, VersionType.CREATED) });
    versionModel.addScope('updated', { where: _defineProperty({}, versionFieldType, VersionType.UPDATED) });
    versionModel.addScope('deleted', { where: _defineProperty({}, versionFieldType, VersionType.DELETED) });

    function getVersions(params) {
        var _this = this;

        var versionParams = {};

        var primaryKeys = Object.keys(model.attributes).filter(function (attr) {
            return model.attributes[attr].primaryKey;
        });

        if (primaryKeys.length) {
            versionParams.where = primaryKeys.map(function (attr) {
                return _defineProperty({}, attr, _this[attr]);
            }).reduce(function (a, b) {
                return Object.assign({}, a, b);
            });
        }

        if (params) {
            if (params.where) versionParams.where = Object.assign({}, params.where, versionParams.where);
            versionParams = Object.assign({}, params, versionParams);
        }

        return versionModel.findAll(versionParams);
    }

    // Sequelize V4 
    if (model.prototype) {

        if (!model.prototype.hasOwnProperty('getVersions')) {

            model.prototype.getVersions = getVersions;
        }

        //Sequelize V3 and above
    } else {

        var hooksForBind = hooks.concat([Hook.AFTER_SAVE]);

        hooksForBind.forEach(function (hook) {
            model.addHook(hook, function (instance) {
                var instances = toArray(instance);
                instances.forEach(function (i) {
                    if (!i.getVersions) i.getVersions = getVersions;
                });
            });
        });
    }

    if (!model.getVersions) {

        model.getVersions = function (params) {
            return versionModel.findAll(params);
        };
    }

    return versionModel;
}

Version.defaults = defaults;
Version.VersionType = VersionType;

module.exports = Version;
