[![Build Status](https://travis-ci.org/ivmarcos/sequelize-version.svg?branch=master)](https://travis-ci.org/ivmarcos/sequelize-version)

# sequelize-version
Automatically version (audit, log) your sequelize models, tracking all the changes (create, update, delete) by generating a version of the model than can be used for easy
querying, see the changes made, or whatever you want. The version model uses sequelize hooks to persist the data.

## Installation

```shell
npm i sequelize-version
```
or
```shell
yarn add sequelize-version
```
## Features

* Custom settings (version prefix, suffix, schema and more)
* Supports transaction 


## Basic Usage
```js
const Sequelize = require('sequelize');
const Version = require('sequelize-version');

const sequelize = new Sequelize(...);

const Person = sequelize.define('Person', ...);

const PersonVersion = new Version(Person);

//sync with database
sequelize.sync().then(() => {
    console.log('sync done!')
});
```

## Options

|Name            |Type               |Default       |Description
|----------------|-------------------|--------------|--------------------------------
|prefix          | `string`          | `'version'`  | Table name prefix
|suffix          | `string`          | `''`         | Table name suffix
|attributePrefix | `string`          | `'version'`  | Attribute prefix for version fields (version id, type and timestamp)
|schema          | `string`          | `''`         | Version model schema, uses from origin model when empty
|sequelize       | `sequelize`       | `null`       | Sequelize instance, uses from origin model when null
|exclude         | `Array<string>`   | `[]`       | Attributes to ignore 

## Examples

### Basic 
```js
// let's create a person for test
let person = await Person.build({name: 'Jack'}).save();

// let's check the result
console.log(JSON.parse(JSON.stringify(person)));
/*
{
    id: 1,
    name: 'Jack'
}
*/

// now we change a name
person.name = 'Jack Johnson';

// and update 
person = await person.save();

console.log(JSON.parse(JSON.stringify(person)));
/*
{
    id: 1,
    name: 'Jack Johnson'
}
*/

// now we delete
await person.destroy();

// finally, we check the modifications
const versions = await PersonVersion.findAll({where : {id: person.id}});

console.log(JSON.parse(JSON.stringify(versions)));
/*
[
    {
        version_id: 1,
        version_type: 1,
        version_timestamp: 2017-08-02T16:08:09.956Z,
        id: 1,
        name: 'Jack'
    },
    {
        version_id: 2,
        version_type: 2,
        version_timestamp: 2017-08-02T16:18:09.958Z,
        id: 1,
        name: 'Jack Johnson'
    },
    {
        version_id: 3,
        version_type: 3,
        version_timestamp: 2017-08-02T16:18:09.959Z,
        id: 1,
        name: 'Jack Johnson'
    },
]
*/
```
### Custom options
```js
//customization examples
const customOptions = {
    
    //table name prefix
    prefix: '', //

    //table name suffix
    suffix: 'log', 

    //attribute prefix
    attributePrefix: 'revision', 

    //version model schema
    schema: 'audit',

    //you can use another sequelize instance 
    sequelize: new Sequelize(...), 

    //atributes to ignore from origin model
    exclude: ['createdAt', 'updateAt'] 

}

// single options
const VersionModel = new Version(Model, customOptions);

// global options
Version.defaults = customOptions;
```


### Transaction
```js
//version uses the origin model transaction
sequelize.transaction(transaction => {

    return Person.build({name: 'Jack'}).save({transaction});

});

//or, if you are using cls - http://docs.sequelizejs.com/manual/tutorial/transactions.html#without-cls-enabled
sequelize.transaction(() => {

    return Person.build({name: 'Jack'}).save();
})
```

### Find by version type (create, save, delete)
```js

const AuditModel = new Version(Person);

// default scopes created in version model (created, updated, deleted)

const personWhenCreated = await AuditModel.scope('created').find({where: {id: person.id}});

const allVersionsUpdated = await AuditModel.scope('updated').findAll();;

const personWhenDeleted = await AuditModel.scope('deleted').find({where: {id: person.id}});
```

## License

The files included in this repository are licensed under the MIT license.