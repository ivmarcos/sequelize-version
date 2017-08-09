const assert = require('assert');
const {Version} = require('../src/decorators');
const Sequelize = require('sequelize');

import {Sequelize, Model, DataTypes} from 'sequelize'
import {Options, Attribute} from 'sequelize-decorators'
 
const sequelize = new Sequelize(process.env.DB)
 
@Options({
    sequelize,
    tableName: 'users'
})
export class User extends Model {
 
    @Attribute({
        type: DataTypes.STRING,
        primaryKey: true
    })
    public username: string;
 
    @Attribute(DataTypes.STRING)
    public firstName: string;
 
    @Attribute() // Type is inferred as DataTypes.STRING 
    public lastName: string;
 
    get fullName(): string {
        return this.firstName + ' ' + this.lastName;
    }
 
    set fullName(fullName: string) {
        const names = fullName.split(' ');
        this.lastName = names.pop();
        this.firstName = names.join(' ');
    }
}