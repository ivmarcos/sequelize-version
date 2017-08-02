const assert = require('assert');
const Version = require('../lib');
const Sequelize = require('sequelize');
const env = process.env;

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


});