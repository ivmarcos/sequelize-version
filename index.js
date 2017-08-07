'use strict';

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var Sequelize = require('sequelize');

function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
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

var VersionType = {
    CREATED: 1,
    UPDATED: 2,
    DELETED: 3
};

var defaults = {
    prefix: 'version',
    attributePrefix: 'version',
    suffix: '',
    schema: '',
    namespace: null,
    sequelize: null,
    exclude: []
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

    var options = Object.assign({}, defaults, Version.defaults, customOptions);

    var prefix = options.prefix;
    var suffix = options.suffix;
    var sequelize = options.sequelize || model.sequelize;
    var namespace = options.namespace;
    var excludeAttrs = options.exclude;
    var schema = options.schema || model.options.schema;
    var attributePrefix = options.attributePrefix;

    var versionModelName = '' + capitalize(prefix) + capitalize(model.name);

    var versionFieldId = attributePrefix + '_id';
    var versionFieldType = attributePrefix + '_type';
    var versionFieldTimestamp = attributePrefix + '_timestamp';

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

    var cloneModelAttrs = cloneAttrs(model, attrsToClone, excludeAttrs);
    var versionModelAttrs = Object.assign({}, cloneModelAttrs, versionAttrs);
    var tableName = prefix.toLowerCase() + '_' + (model.options.tableName || model.name.toLowerCase()) + (suffix ? '_' + suffix : '');

    var versionModelOptions = {
        schema: schema,
        tableName: tableName,
        timestamps: false
    };

    var versionModel = sequelize.define(versionModelName, versionModelAttrs, versionModelOptions);

    hooks.forEach(function (hook) {

        model.addHook(hook, function (instanceData, _ref) {
            var _Object$assign;

            var transaction = _ref.transaction;


            var versionType = getVersionType(hook);

            var data = JSON.parse(JSON.stringify(instanceData));

            var versionData = Object.assign({}, data, (_Object$assign = {}, _defineProperty(_Object$assign, versionFieldType, versionType), _defineProperty(_Object$assign, versionFieldTimestamp, new Date()), _Object$assign));

            var cls = namespace || Sequelize.cls;

            var versionTransaction = void 0;

            if (sequelize === model.sequelize) {
                versionTransaction = cls ? cls.get('transaction') || transaction : transaction;
            } else {
                versionTransaction = cls ? cls.get('transaction') : undefined;
            }

            return versionModel.build(versionData).save({ transaction: versionTransaction });
        });
    });

    versionModel.addScope('created', { where: _defineProperty({}, versionFieldType, VersionType.CREATED) });
    versionModel.addScope('updated', { where: _defineProperty({}, versionFieldType, VersionType.UPDATED) });
    versionModel.addScope('deleted', { where: _defineProperty({}, versionFieldType, VersionType.DELETED) });

    return versionModel;
}

Version.defaults = defaults;
Version.VersionType = VersionType;

module.exports = Version;
