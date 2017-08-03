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

* Track automatically all the changes of your model (create, update, delete), using hooks
* Custom settings (version prefix, suffix, schema)
* Supports transaction (cls required - http://docs.sequelizejs.com/manual/tutorial/transactions.html#automatically-pass-transactions-to-all-queries)


## Basic Usage
```js
const Sequelize = require('sequelize');
const Version = require('sequelize-version');

const sequelize = new Sequelize(...);

const Person = sequelize.define('Person', ...);

const PersonVersion = new Version(Person);
```

## Examples

### Simple 
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

// finally we check the versions created for the person
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

]
*/
```
### Custom options
```js
const prefix = ''; 
const suffix = 'log'; 
const schema = 'audit';

// single options
const VersionModel = new Version(Model, {prefix, suffix, schema});


// Global options
Version.defaults.prefix = prefix; //default 'version'
Version.defaults.suffix = suffix; //default ''
Version.defaults.schema = schema; //default '' - if empty string, will be used the same schema of the origin model

```


### Transaction (cls required)
```js
const cls = require('continuation-local-storage');
const namespace = cls.createNamespace('my-very-own-namespace');

Sequelize.useCLS(namespace); //Sequelize.cls = namespace - for older versions of sequelize, above 4

//with cls the transaction will be passed automatically in all queries inside sequelize.transaction function, including version hooks
sequelize.transaction(() => {

    return TestModel.build({name: 'Test with transaction'});

});
```

### Find by version type (create, save, delete)
```js
const AuditModel = new Version(TestModel);

const {CREATE, DELETE, UPDATE} = Version.VersionType;

const created = await AuditModel.findAll({where: {version_type_id: CREATE}});
const updated = await AuditModel.findAll({where: {version_type_id: UPDATE}});
const deleted = await AuditModel.findAll({where: {version_type_id: DELETE}});
```

## License

The files included in this repository are licensed under the MIT license.