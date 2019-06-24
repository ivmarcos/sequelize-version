const Sequelize = require('sequelize');
import * as utils from './utils';
import { Hook, VersionType } from './types';

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
  associations: false,
  associationConstraints: false,
};

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

function addQueries(model, versionModel) {
  function getVersions(params) {
    let versionParams = {};

    const primaryKeys = Object.keys(model.attributes).filter(
      attr => model.attributes[attr].primaryKey
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
  // Sequelize V4
  if (model.prototype) {
    if (!model.prototype.hasOwnProperty('getVersions')) {
      model.prototype.getVersions = getVersions;
    }

    //Sequelize V3 and above
  } else {
    const hooksForBind = hooks.concat([Hook.AFTER_SAVE]);

    hooksForBind.forEach(hook => {
      model.addHook(hook, instance => {
        const instances = utils.toArray(instance);
        instances.forEach(i => {
          if (!i.getVersions) i.getVersions = getVersions;
        });
      });
    });
  }

  if (!model.getVersions) {
    model.getVersions = params => versionModel.findAll(params);
  }
}

function addScopes(versionModel, versionFieldType) {
  versionModel.addScope('created', {
    where: { [versionFieldType]: VersionType.CREATED },
  });
  versionModel.addScope('updated', {
    where: { [versionFieldType]: VersionType.UPDATED },
  });
  versionModel.addScope('deleted', {
    where: { [versionFieldType]: VersionType.DELETED },
  });
}

function addHooks(model, versionModel, options) {
  hooks.forEach(hook => {
    model.addHook(hook, (instanceData, { transaction }) => {
      const cls = options.namespace || model.Sequelize.cls;

      let versionTransaction;

      if (options.sequelize === model.sequelize) {
        versionTransaction = cls
          ? cls.get('transaction') || transaction
          : transaction;
      } else {
        versionTransaction = cls ? cls.get('transaction') : undefined;
      }

      const versionType = getVersionType(hook);
      const instancesData = utils.toArray(instanceData);

      const versionData = instancesData.map(data => {
        return Object.assign({}, utils.clone(data), {
          [options.versionFieldType]: versionType,
          [options.versionFieldTimestamp]: new Date(),
        });
      });

      return versionModel.bulkCreate(versionData, {
        transaction: versionTransaction,
      });
    });
  });
}

function normalizeOptions(model, options) {
  const { prefix, tableUnderscored, underscored, suffix } = options;
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
  const versionModelName = `${utils.capitalize(prefix)}${utils.capitalize(
    model.name
  )}`;
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
  const build = {
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

function createVersionModel(model, options) {
  const cloneModelAttrs = utils.cloneAttrs(
    model,
    attrsToClone,
    options.exclude
  );
  const versionModelAttrs = Object.assign(
    {},
    cloneModelAttrs,
    options.versionAttrs
  );
  const versionModelOptions = {
    schema: options.schema,
    tableName: options.tableName,
    timestamps: false,
  };
  const versionModel = options.sequelize.define(
    options.versionModelName,
    versionModelAttrs,
    versionModelOptions
  );
  return versionModel;
}

function cloneAssociations(model, versionModel, options) {
  Object.keys(model.associations).forEach(key => {
    const association = model.associations[key];
    console.log('association', Object.keys(association));
    versionModel[association.associationType.toLowerCase()](
      association.target,
      Object.assign({}, association.options, {
        constraints: options.associationConstraints,
      })
    );
  });
}

function validateOptions(options) {
  if (utils.isEmpty(options.prefix) && utils.isEmpty(options.suffix)) {
    throw new Error('Prefix or suffix must be informed in options.');
  }
}

function Version(model, customOptions) {
  validateOptions(customOptions);
  const options = normalizeOptions(
    Object.assign({}, defaults, Version.defaults, customOptions)
  );
  const versionModel = createVersionModel();
  if (options.associations) {
    cloneAssociations(model, versionModel, options);
  }
  addHooks(model, versionModel, options);
  addScopes(versionModel, options.versionFieldType);
  addQueries(model);
  return versionModel;
}

Version.defaults = Object.assign({}, defaults);
Version.VersionType = VersionType;

module.exports = Version;
