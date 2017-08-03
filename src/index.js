const Sequelize = require('sequelize');

function capitalize(string){
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function cloneAttrs(model, attrs){

    let clone = {};

    for (var p in model.attributes){

        let nestedClone = {};
        
        const attribute = model.attributes[p];

        for (var np in attribute){
            if (attrs.indexOf(np) > -1){
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
    DELETED: 3
}

const defaults = {
    prefix: 'version',
    suffix: '',
}

const hooks = ['afterUpdate', 'afterCreate', 'afterDestroy'];
const attrsToClone = ['type', 'defaultValue', 'field'];

function Version(model, customOptions) {

    const options = Object.assign({}, Version.defaults, customOptions);

    const prefix = options.prefix;
    const suffix = options.suffix;

    const versionModelName = `${capitalize(prefix)}${capitalize(model.name)}`;

    //const primaryKeys = getPrimaryKeys(model);

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

    const cloneModelAttrs = cloneAttrs(model, attrsToClone);

    const versionModelAttrs = Object.assign({}, cloneModelAttrs, versionAttrs);

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
