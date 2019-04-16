const Sequelize = require('sequelize');

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
  const clone = {};
  const attributes = model.rawAttributes || model.attributes;
  for (const p in attributes) {
    if (excludeAttrs.indexOf(p) > -1) continue;
    const nestedClone = {};
    const attribute = attributes[p];
    for (const np in attribute) {
      if (attrs.indexOf(np) > -1) {
        nestedClone[np] = attribute[np];
      }
    }
    clone[p] = nestedClone;
  }
  return clone;
}

const VersionType = {
  CREATED: 1,
  UPDATED: 2,
  DELETED: 3,
};

const Hook = {
  AFTER_CREATE: 'afterCreate',
  AFTER_UPDATE: 'afterUpdate',
  AFTER_DESTROY: 'afterDestroy',
  AFTER_SAVE: 'afterSave',
  AFTER_BULK_CREATE: 'afterBulkCreate',
};

const defaults = {
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
};

function isEmpty(string) {
  return [undefined, null, NaN, ''].indexOf(string) > -1;
}

const hooks = [
  Hook.AFTER_CREATE,
  Hook.AFTER_UPDATE,
  Hook.AFTER_BULK_CREATE,
  Hook.AFTER_DESTROY,
];

const attrsToClone = ['type', 'field', 'get', 'set'];

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

function Version(model, customOptions) {
  const options = Object.assign({}, defaults, Version.defaults, customOptions);

  const {
    prefix,
    suffix,
    namespace,
    exclude,
    tableUnderscored,
    underscored,
  } = options;

  if (isEmpty(prefix) && isEmpty(suffix)) {
    throw new Error('Prefix or suffix must be informed in options.');
  }

  const sequelize = options.sequelize || model.sequelize;
  const schema = options.schema || model.options.schema;
  const attributePrefix = options.attributePrefix || options.prefix;
  const tableName = `${
    prefix ? `${prefix}${tableUnderscored ? '_' : ''}` : ''
  }${model.options.tableName || model.name}${
    suffix ? `${tableUnderscored ? '_' : ''}${suffix}` : ''
  }`;
  const versionFieldType = `${attributePrefix}${underscored ? '_t' : 'T'}ype`;
  const versionFieldId = `${attributePrefix}${underscored ? '_i' : 'I'}d`;
  const versionFieldTimestamp = `${attributePrefix}${
    underscored ? '_t' : 'T'
  }imestamp`;
  const versionModelName = `${capitalize(prefix)}${capitalize(model.name)}`;

  const versionAttrs = {
    [versionFieldId]: {
      type: Sequelize.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    [versionFieldType]: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    [versionFieldTimestamp]: {
      type: Sequelize.DATE,
      allowNull: false,
    },
  };

  const cloneModelAttrs = cloneAttrs(model, attrsToClone, exclude);
  const versionModelAttrs = Object.assign({}, cloneModelAttrs, versionAttrs);

  const versionModelOptions = {
    schema,
    tableName,
    timestamps: false,
  };

  const versionModel = sequelize.define(
    versionModelName,
    versionModelAttrs,
    versionModelOptions
  );

  hooks.forEach(hook => {
    model.addHook(hook, (instanceData, { transaction }) => {
      const cls = namespace || Sequelize.cls;

      let versionTransaction;

      if (sequelize === model.sequelize) {
        versionTransaction = cls
          ? cls.get('transaction') || transaction
          : transaction;
      } else {
        versionTransaction = cls ? cls.get('transaction') : undefined;
      }

      const versionType = getVersionType(hook);
      const instancesData = toArray(instanceData);

      const versionData = instancesData.map(data => {
        return Object.assign({}, clone(data), {
          [versionFieldType]: versionType,
          [versionFieldTimestamp]: new Date(),
        });
      });

      return versionModel.bulkCreate(versionData, {
        transaction: versionTransaction,
      });
    });
  });

  versionModel.addScope('created', {
    where: { [versionFieldType]: VersionType.CREATED },
  });

  versionModel.addScope('updated', {
    where: { [versionFieldType]: VersionType.UPDATED },
  });

  versionModel.addScope('deleted', {
    where: { [versionFieldType]: VersionType.DELETED },
  });

  function getVersions(params) {
    let versionParams = {};
    const modelAttributes = model.rawAttributes || model.attributes;
    const primaryKeys = Object.keys(
      modelAttributes
    ).filter(
      attr => (modelAttributes)[attr].primaryKey
    );

    if (primaryKeys.length) {
      versionParams.where = primaryKeys
        .map(attr => ({ [attr]: this[attr] }))
        .reduce((a, b) => Object.assign({}, a, b));
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

  // Sequelize V4 and above
  if (model.prototype) {
    if (!model.prototype.hasOwnProperty('getVersions')) {
      model.prototype.getVersions = getVersions;
    }

    //Sequelize V3 and below
  } else {
    const hooksForBind = hooks.concat([Hook.AFTER_SAVE]);

    hooksForBind.forEach(hook => {
      model.addHook(hook, instance => {
        const instances = toArray(instance);
        instances.forEach(i => {
          if (!i.getVersions) i.getVersions = getVersions;
        });
      });
    });
  }

  if (!model.getVersions) {
    model.getVersions = params => versionModel.findAll(params);
  }

  return versionModel;
}

Version.defaults = Object.assign({}, defaults);
Version.VersionType = VersionType;

module.exports = Version;
