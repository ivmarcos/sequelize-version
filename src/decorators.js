const SequelizeVersion = require('./index');

export function Version(options){
    return function(target){
        new SequelizeVersion(target, options);
    }
}