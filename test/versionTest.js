const assert = require('assert');
const Version = require('../lib');
const Sequelize = require('sequelize');
const cls = require('continuation-local-storage');
const should = require('should');
const env = process.env;

const namespace = cls.createNamespace('my-very-own-namespace');
Sequelize.useCLS(namespace);

const sequelize = new Sequelize(env.DB_TEST, env.DB_USER, env.DB_PWD, {
    logging: console.log,
    dialect: 'postgres',
    define: {
        timestamps: false,
    }
});    

const TestModel = sequelize.define('test', {
    id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
    },
    name: {
        type: Sequelize.STRING,
    }
});

const VersionTestModel = new Version(TestModel);

before(done => {

    sequelize.sync({force: true, logging: console.log}).then(() => done()).catch(err => done(err));

});

describe('sequelize-version', () => {

    it ('basic usage', done => {

        const teste = async() => {

            try{

                const testInstance = await TestModel.build({name: 'test'}).save();

                const versionInstance = await VersionTestModel.find({where : {
                    id: testInstance.id
                }});

                return assert.equal(versionInstance.id, testInstance.id);

            }catch(err){

                return err;
            }

        }

        teste().then(result => done(result)).catch(err => done(err));

    })


    it ('must support transaction with cls', done => {


        const teste = async() => {


            try{

                return await sequelize.transaction(async() => {

                    await TestModel.destroy();

                    await VersionTestModel.destroy();

                    await TestModel.build({name: 'test'}).save();

                    throw new Error('error to rollback transaction')

                    return;

                }).catch(async err => {

                    const versions = await VersionTestModel.findAll();

                    assert.equal(versions, null);

                });

            }catch(err){

                return err;

            }


        }


        teste().then(result => done(result)).catch(err => done(err));

    });



});