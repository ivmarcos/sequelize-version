[![Build Status](https://travis-ci.org/ivmarcos/sequelize-version.svg?branch=master)](https://travis-ci.org/ivmarcos/sequelize-version)

# sequelize-version
Automatically version your sequelize models

## Installation

```shell
npm i sequelize-version
```
or
```shell
yarn add sequelize-version
```
## Features

* Custom settings (version prefix)
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
        version_type: 1,
        version_timestamp: 2017-08-02T16:18:09.958Z,
        id: 1,
        name: 'Jack Johnson'
    },

]
*/
```


## License

The files included in this repository are licensed under the MIT license.