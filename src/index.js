const Sequelize = require('sequelize');

function capitalize(string){
    return string.charAt(0).toUpperCase() + string.slice(1);
}


function cloneAttrs(model, attrs){

    let clone = {};

    const attributes = model.attributes;

    for (let p in attributes){

        let nestedClone = {};
        
        const attribute = attributes[p];

        for (let np in attribute){
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

const hooks = ['afterCreate', 'afterUpdate', 'afterDestroy'];
const attrsToClone = ['type', 'field'];

function getVersionType(hook){
    if (hook === 'afterCreate') return VersionType.CREATED;
    if (hook === 'afterUpdate') return VersionType.UPDATED;
    if (hook === 'afterDestroy') return VersionType.DELETED;
}

function Version(model, customOptions) {

    const options = Object.assign({}, defaults, Version.defaults, customOptions);
   
    const prefix = options.prefix;
    const suffix = options.suffix;
    
    const versionModelName = `${capitalize(prefix)}${capitalize(model.name)}`;
    
    const versionFieldId = `${prefix}_id`;
    const versionFieldType = `${prefix}_type`;
    const versionFieldTimestamp = `${prefix}_timestamp`

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
    }

    const cloneModelAttrs = cloneAttrs(model, attrsToClone);
    const versionModelAttrs = Object.assign({}, cloneModelAttrs, versionAttrs);
    const tableName = `${prefix.toLowerCase()}_${model.options.tableName || model.name.toLowerCase()}${suffix ? `_${suffix}`:''}`;

    const versionModelOptions = {
        schema: options.schema || model.options.schema,
        tableName,
        timestamps: false,
    }

    const versionModel = model.sequelize.define(versionModelName, versionModelAttrs, versionModelOptions)

    hooks.forEach(hook => {

        model.addHook(hook, (instanceData, {transaction}) => {

            let versionType = getVersionType(hook);

            const data = JSON.parse(JSON.stringify(instanceData));

            const versionData = Object.assign({}, data, {[versionFieldType]: versionType, [versionFieldTimestamp]: new Date()});
            
            return versionModel.build(versionData).save({transaction});

        })

    });


    return versionModel;

}


Version.defaults = defaults;
Version.VersionType = VersionType;

module.exports = Version;
