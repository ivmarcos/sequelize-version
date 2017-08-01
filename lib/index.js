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

const defaultOptions ={
    prefix: 'version'
}

const hooks = ['afterCreate', 'afterUpdate', 'afterSave', 'afterDestroy'];

const VersionType = {
    CREATE: 1,
    UPDATE: 2,
    DELETE: 3
}

module.exports = (model, customOptions) => {

    const options = Object.assign({}, defaultOptions, customOptions);

    const prefix = options.prefix;

    const versionModelName = `${capitalize(prefix)}${capitalize(model.name)}`;

    const primaryKeys = getPrimaryKeys(model);

    const versionExclusiveAttrs = {
        [`${prefix}_id`]: {
            type: Sequelize.BIGINT,
            primaryKey: true,
            autoIncrement: true,
        },
        [`${prefix}_type`]: {
            type: Sequelize.INTEGER,
        },
        [`${prefix}_timestamp`]: {
            type: Sequelize.TIMESTAMP,
            defaultValue: Sequelize.NOW,
        },
    }

    const versionModelAttrs = Object.assign({}, model.attributes, versionExclusiveAttrs);

    primaryKeys.forEach(pk => {
        versionModelAttrs[pk].autoIncrement = false;
    });

    const tableName = `${prefix.toLowerCase()}_${model.options.tableName}`;

    const versionModelOptions = {
        schema: model.options.schema,
        tableName,
    }

    const versionModel = model.sequelize.define(versionModelName, versionModelAttrs, versionModelOptions)

    hooks.forEach(hook => {

        model.addHook(hook, (instanceData) => {

            let versionType = VersionType.CREATE;
        
            switch (hook){
            case 'afterUpdate': case 'afterSave':
                versionType = VersionType.UPDATE;
                break;
            case 'afterDestroy':
                versionType = VersionType.DELETE;
                break;
            }

            const data = JSON.parse(JSON.stringify(instanceData));

            const versionData = Object.assign({}, data, {[`${prefix}_type`]: versionType});

            return versionModel.build(versionData).save();

        })

    });

    versionModel.VersionType = VersionType;

    return versionModel;

}

