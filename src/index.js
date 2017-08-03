const Sequelize = require('sequelize');

function capitalize(string){
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function getPrimaryKeys(model) {

    let primaryKeys = [];

    for (var p in model.attributes) {

        const attr = model.attributes[p];

        if (attr.primaryKey) primaryKeys.push(p);

    }

    return primaryKeys;
}

function cloneAttrs(model){
    return Object.keys(model.attributes).map(attr => {
        return {
            [attr]: Object.assign({}, model.attributes[attr])
        }
    }).reduce((a, b) => Object.assign(a, b));
}

const VersionType = {
    CREATED: 1,
    UPDATED: 2,
    DELETED: 3
}

const defaults = {
    prefix: 'version',
    suffix: '',
}

const hooks = ['afterUpdate', 'afterCreate', 'afterDestroy'];

function Version(model, customOptions) {

    const options = Object.assign({}, Version.defaults, customOptions);

    const prefix = options.prefix;
    const suffix = options.suffix;

    const versionModelName = `${capitalize(prefix)}${capitalize(model.name)}`;

    const primaryKeys = getPrimaryKeys(model);

    const versionAttrs = {
        [`${prefix}_id`]: {
            type: Sequelize.BIGINT,
            primaryKey: true,
            autoIncrement: true,
        },
        [`${prefix}_type`]: {
            type: Sequelize.INTEGER,
        },
        [`${prefix}_timestamp`]: {
            type: Sequelize.DATE,
            defaultValue: Sequelize.NOW
        },
    }

    const cloneModelAttrs = cloneAttrs(model);

    const versionModelAttrs = Object.assign({}, cloneModelAttrs, versionAttrs);

    primaryKeys.forEach(pk => {
        delete versionModelAttrs[pk].autoIncrement;        
        delete versionModelAttrs[pk].primaryKey;
    });

    const tableName = `${prefix.toLowerCase()}_${model.options.tableName || model.name.toLowerCase()}${suffix ? `_${suffix}`:''}`;

    const versionModelOptions = {
        schema: options.schema || model.options.schema,
        tableName,
    }

    const versionModel = model.sequelize.define(versionModelName, versionModelAttrs, versionModelOptions)

    hooks.forEach(hook => {

        model.addHook(hook, (instanceData) => {

            let versionType = VersionType.CREATED;
        
            switch (hook){
            case 'afterUpdate': 
                versionType = VersionType.UPDATED;
                break;
            case 'afterDestroy':
                versionType = VersionType.DELETED;
                break;
            }

            const data = JSON.parse(JSON.stringify(instanceData));

            const versionData = Object.assign({}, data, {[`${prefix}_type`]: versionType});

            return versionModel.build(versionData).save();

        })

    });


    return versionModel;

}


Version.defaults = defaults;
Version.VersionType = VersionType;

module.exports = Version;
