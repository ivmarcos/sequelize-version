const assert = require('assert');
const Version = require('../lib');
const Sequelize = require('sequelize');
const cls = require('continuation-local-storage');
const env = process.env;

const namespace = cls.createNamespace('my-very-own-namespace');
Sequelize.useCLS(namespace);

const sequelize = new Sequelize(env.DB_TEST, env.DB_USER, env.DB_PWD, {
    logging: () => {},
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

    sequelize.sync({force: true}).then(() => done()).catch(err => done(err));

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

        const ERR_MSG = 'ROLLBACK_CLS_TEST';

        const teste = async() => {


            try{

                await TestModel.destroy({truncate: true}),
                await VersionTestModel.destroy({truncate: true}),
                await sequelize.transaction(async() => {

                    console.log('executando')

                    return Promise.all([
                         TestModel.build({name: 'test transaction cls'}).save().then(() => Promise.reject(new Error(ERR_MSG))),
                    ]);

                }).catch(async err => {

                    if (err.message === ERR_MSG){
                        const versions = await VersionTestModel.findAll();
                        assert.equal(versions.length, 0);

                    }else{
                        assert.fail(err);
                    }


                });

            }catch(err){

                return err;

            }


        }


        teste().then(result => done(result)).catch(err => done(err));

    });

    it ('Must deal with custom options', () => {

        const schema = 'test2';
        const prefix = 'version';
        const suffix = 'log';

        const V2 = new Version(TestModel, {schema, prefix, suffix});

        assert.equal(V2.options.schema, schema)
        assert.equal(true, new RegExp(`^${prefix}`).test(V2.options.tableName));
        assert.equal(true, new RegExp(`${suffix}$`).test(V2.options.tableName));

    })

});