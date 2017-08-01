[![Build Status](https://travis-ci.org/ivmarcos/sequelize-versionify.svg?branch=master)](https://travis-ci.org/ivmarcos/sequelize-versionify)

# sequelize-versionify
Automatically versionify your sequelize models

## Installation

```shell
npm i sequelize-versionify
```
or
```shell
yarn add sequelize-versionify
```
## Features

* Custom settings (version prefix)
* Supports transaction (cls required - http://docs.sequelizejs.com/manual/tutorial/transactions.html#automatically-pass-transactions-to-all-queries)


## Basic Usage
```js
const Sequelize = require('sequelize');
const Version = require('sequelize-versionify');

const sequelize = new Sequelize(...);

// regular model of sequelize
const Person = sequelize.define('Person', {
    id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: Sequelize.STRING
    },
});

// version model of sequelize (model cloned with some extra attributes)
const PersonVersion = new Version(Person);

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
        version_timestamp: 100020200,
        id: 1,
        name: 'Jack'
    },
    {
        version_id: 2,
        version_type: 1,
        version_timestamp: 100020200,
        id: 1,
        name: 'Jack Johnson'
    },

]
*/




```


## License

The files included in this repository are licensed under the MIT license.