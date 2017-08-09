const Sequelize = require('sequelize');

function capitalize(string){
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function cloneAttrs(model, attrs, excludeAttrs){

    let clone = {};

    const attributes = model.attributes;

    for (let p in attributes){

        if (excludeAttrs.indexOf(p) > -1) continue;

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
    attributePrefix: 'version',
    suffix: '',
    schema: '',
    namespace: null,
    sequelize: null,
    exclude: [],
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
    const sequelize = options.sequelize || model.sequelize;
    const namespace = options.namespace;
    const excludeAttrs = options.exclude;
    const schema = options.schema || model.options.schema;
    const attributePrefix = options.attributePrefix;
    
    const versionModelName = `${capitalize(prefix)}${capitalize(model.name)}`;
    
    const versionFieldId = `${attributePrefix}_id`;
    const versionFieldType = `${attributePrefix}_type`;
    const versionFieldTimestamp = `${attributePrefix}_timestamp`;

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

    const cloneModelAttrs = cloneAttrs(model, attrsToClone, excludeAttrs);
    const versionModelAttrs = Object.assign({}, cloneModelAttrs, versionAttrs);
    const tableName = `${prefix.toLowerCase()}_${model.options.tableName || model.name.toLowerCase()}${suffix ? `_${suffix}`:''}`;

    const versionModelOptions = {
        schema,
        tableName,
        timestamps: false,
    }

    const versionModel = sequelize.define(versionModelName, versionModelAttrs, versionModelOptions)

    hooks.forEach(hook => {

        model.addHook(hook, (instanceData, {transaction}) => {

            let versionType = getVersionType(hook);

            const data = JSON.parse(JSON.stringify(instanceData));

            const versionData = Object.assign({}, data, {[versionFieldType]: versionType, [versionFieldTimestamp]: new Date()});

            const cls = namespace || Sequelize.cls;

            let versionTransaction;
            
            if (sequelize === model.sequelize){
                versionTransaction = cls ? (cls.get('transaction') || transaction) : transaction;
            }else{
                versionTransaction = cls ? cls.get('transaction') : undefined;
            }
            
            return versionModel.build(versionData).save({transaction : versionTransaction});

        })

    });

    versionModel.addScope('created', {where: {[versionFieldType]: VersionType.CREATED}});
    versionModel.addScope('updated', {where: {[versionFieldType]: VersionType.UPDATED}});
    versionModel.addScope('deleted', {where: {[versionFieldType]: VersionType.DELETED}});

    function getVersions(params){
        
        let versionParams = {};
            
        const primaryKeys = Object.keys(model.attributes).filter(attr => model.attributes[attr].primaryKey);
            
        if (primaryKeys.length) {
            versionParams.where = primaryKeys.map(attr => ({[attr]: this[attr]})).reduce((a, b) => Object.assign({}, a, b));
        }
            
        if (params){
            if (params.where) versionParams.where = Object.assign({}, params.where, versionParams.where);
            versionParams = Object.assign({}, params, versionParams);
        }

        return versionModel.findAll(versionParams);

    }

    if (model.prototype){

        if (!model.prototype.hasOwnProperty('getVersions')){ 
            
            model.prototype.getVersions = getVersions;
    
        }
    
    }else{

        const hooksForBind = ['afterCreate', 'afterDestroy', 'afterUpdate', 'afterSave'];
        
        hooksForBind.forEach(hook => {
            model.addHook(hook, (instance) => {
                if (!instance.getVersions) instance.getVersions = getVersions;
            })
        })
    }

    if (!model.getVersions){

        model.getVersions = (params) => versionModel.findAll(params);
        
    }

    return versionModel;

}


Version.defaults = defaults;
Version.VersionType = VersionType;

module.exports = Version;
