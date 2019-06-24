function isEmpty(string) {
  return [undefined, null, NaN, ''].indexOf(string) > -1;
}

function toArray$1(value) {
  return Array.isArray(value) ? value : [value];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

var VersionType = {
  CREATED: 1,
  UPDATED: 2,
  DELETED: 3,
};

var Hook = {
  AFTER_CREATE: 'afterCreate',
  AFTER_UPDATE: 'afterUpdate',
  AFTER_DESTROY: 'afterDestroy',
  AFTER_SAVE: 'afterSave',
  AFTER_BULK_CREATE: 'afterBulkCreate',
};

var defineProperty = function(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  } else {
    obj[key] = value;
  }

  return obj;
};

var set = function set(object, property, value, receiver) {
  var desc = Object.getOwnPropertyDescriptor(object, property);

  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);

    if (parent !== null) {
      set(parent, property, value, receiver);
    }
  } else if ('value' in desc && desc.writable) {
    desc.value = value;
  } else {
    var setter = desc.set;

    if (setter !== undefined) {
      setter.call(receiver, value);
    }
  }

  return value;
};

var Sequelize = require('sequelize');
var defaults$$1 = {
  prefix: 'version',
  attributePrefix: '',
  suffix: '',
  schema: '',
  namespace: null,
  sequelize: null,
  exclude: [],
  tableUnderscored: true,
  underscored: true,
  versionAttributes: null,
  associations: false,
  associationConstraints: false,
};

var hooks = [
  Hook.AFTER_CREATE,
  Hook.AFTER_UPDATE,
  Hook.AFTER_BULK_CREATE,
  Hook.AFTER_DESTROY,
];

var attrsToClone = ['type', 'field', 'get', 'set'];

function getVersionType(hook) {
  switch (hook) {
  case Hook.AFTER_CREATE:
  case Hook.AFTER_BULK_CREATE:
    return VersionType.CREATED;
  case Hook.AFTER_UPDATE:
    return VersionType.UPDATED;
  case Hook.AFTER_DESTROY:
    return VersionType.DELETED;
  }
  throw new Error('Version type not found for hook ' + hook);
}

function addQueries(model) {
  function getVersions(params) {
    var _this = this;

    var versionParams = {};

    var primaryKeys = Object.keys(model.attributes).filter(function(attr) {
      return model.attributes[attr].primaryKey;
    });

    if (primaryKeys.length) {
      versionParams.where = primaryKeys
        .map(function(attr) {
          return defineProperty({}, attr, _this[attr]);
        })
        .reduce(function(a, b) {
          return Object.assign({}, a, b);
        });
    }

    if (params) {
      if (params.where)
        versionParams.where = Object.assign(
          {},
          params.where,
          versionParams.where
        );
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

    hooksForBind.forEach(function(hook) {
      model.addHook(hook, function(instance) {
        var instances = toArray(instance);
        instances.forEach(function(i) {
          if (!i.getVersions) i.getVersions = getVersions;
        });
      });
    });
  }

  if (!model.getVersions) {
    model.getVersions = function(params) {
      return versionModel.findAll(params);
    };
  }
}

function addScopes(versionModel, versionFieldType) {
  versionModel.addScope('created', {
    where: defineProperty({}, versionFieldType, VersionType.CREATED),
  });
  versionModel.addScope('updated', {
    where: defineProperty({}, versionFieldType, VersionType.UPDATED),
  });
  versionModel.addScope('deleted', {
    where: defineProperty({}, versionFieldType, VersionType.DELETED),
  });
}

function addHooks(model, versionModel, options) {
  hooks.forEach(function(hook) {
    model.addHook(hook, function(instanceData, _ref2) {
      var transaction = _ref2.transaction;

      var cls = options.namespace || model.Sequelize.cls;

      var versionTransaction = void 0;

      if (options.sequelize === model.sequelize) {
        versionTransaction = cls
          ? cls.get('transaction') || transaction
          : transaction;
      } else {
        versionTransaction = cls ? cls.get('transaction') : undefined;
      }

      var versionType = getVersionType(hook);
      var instancesData = toArray$1(instanceData);

      var versionData = instancesData.map(function(data) {
        var _Object$assign;

        return Object.assign(
          {},
          clone(data),
          ((_Object$assign = {}),
          defineProperty(_Object$assign, options.versionFieldType, versionType),
          defineProperty(
            _Object$assign,
            options.versionFieldTimestamp,
            new Date()
          ),
          _Object$assign)
        );
      });

      return versionModel.bulkCreate(versionData, {
        transaction: versionTransaction,
      });
    });
  });
}

function normalizeOptions(model, options) {
  var _versionAttrs;

  var sequelize = options.sequelize || model.sequelize;
  var schema = options.schema || model.options.schema;
  var attributePrefix = options.attributePrefix || options.prefix;
  var tableName =
    '' +
    (prefix ? '' + prefix + (tableUnderscored ? '_' : '') : '') +
    (model.options.tableName || model.name) +
    (suffix ? '' + (tableUnderscored ? '_' : '') + suffix : '');
  var versionFieldType =
    '' + attributePrefix + (underscored ? '_t' : 'T') + 'ype';
  var versionFieldId = '' + attributePrefix + (underscored ? '_i' : 'I') + 'd';
  var versionFieldTimestamp =
    '' + attributePrefix + (underscored ? '_t' : 'T') + 'imestamp';
  var versionModelName = '' + capitalize(prefix) + capitalize(model.name);
  var versionAttrs = ((_versionAttrs = {}),
  defineProperty(_versionAttrs, versionFieldId, {
    type: Sequelize.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  }),
  defineProperty(_versionAttrs, versionFieldType, {
    type: Sequelize.INTEGER,
    allowNull: false,
  }),
  defineProperty(_versionAttrs, versionFieldTimestamp, {
    type: Sequelize.DATE,
    allowNull: false,
  }),
  _versionAttrs);
  var build = {
    sequelize,
    schema,
    attributePrefix,
    tableName,
    versionFieldType,
    versionFieldId,
    versionFieldTimestamp,
    versionModelName,
    versionAttrs,
  };
  return Object.assign({}, options, build);
}

function createVersionModel() {
  var cloneModelAttrs = cloneAttrs(model, attrsToClone, exclude);
  var versionModelAttrs = Object.assign({}, cloneModelAttrs, versionAttrs);
  var versionModelOptions = {
    schema,
    tableName,
    timestamps: false,
  };
  var versionModel = sequelize.define(
    versionModelName,
    versionModelAttrs,
    versionModelOptions
  );
  return versionModel;
}

function cloneAssociations(model, versionModel, options) {
  Object.keys(model.associations).forEach(function(key) {
    var association = model.associations[key];

    versionModel[association.associationType.toLowerCase()](
      association.target,
      Object.assign({}, association.options, {
        constraints: options.associationConstraints,
      })
    );
  });
}

function validateOptions(options) {
  if (isEmpty(options.prefix) && isEmpty(options.suffix)) {
    throw new Error('Prefix or suffix must be informed in options.');
  }
}

function Version(model, customOptions) {
  validateOptions(customOptions);
  var options = normalizeOptions(
    Object.assign({}, defaults$$1, Version.defaults, customOptions)
  );
  var versionModel = createVersionModel();
  if (options.associations) {
    cloneAssociations(model, versionModel, options);
  }
  addHooks(model, versionModel, options);
  addScopes(versionModel, options.versionFieldType);
  addQueries(model);
  return versionModel;
}

Version.defaults = Object.assign({}, defaults$$1);
Version.VersionType = VersionType;

module.exports = Version;
