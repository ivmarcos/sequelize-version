const assert = require('assert');
const Version = require('../src');
const Sequelize = require('sequelize');
const cls = require('continuation-local-storage');
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

const VersionModel = new Version(TestModel);

before(done => {

    sequelize.sync({force: true}).then(() => done()).catch(err => done(err));

});

describe('sequelize-version', () => {

    beforeEach(done => {
        Promise.all([
            TestModel.destroy({truncate : true}),
            VersionModel.destroy({truncate: true,})
        ]).then(() => done()).catch(err => done(err));
    })

    it ('basic usage', done => {

        const test = async() => {

            try{

                const testInstance = await TestModel.build({name: 'test'}).save();

                const versionInstance = await VersionModel.find({where : {
                    id: testInstance.id
                }});

                const versionsInstance = await VersionModel.findAll({where : {
                    id: testInstance.id
                }});

                assert.equal(versionInstance.id, testInstance.id);
                assert.equal(1, versionsInstance.length);

            }catch(err){

                return err;
            }

        }

        test().then(result => done(result)).catch(err => done(err));

    })


    it ('all hooks working', done => {

        const test = async() => {

            try{

                let testInstance = await TestModel.build({name: 'test'}).save();
                testInstance.name = 'test changed';

                await testInstance.save();
                await testInstance.destroy();

                const versionsInstance = await VersionModel.findAll({where : {
                    id: testInstance.id
                }});

                return versionsInstance
               

            }catch(err){

                return err;
            }

        }

        test().then(versionsInstance => {

            assert.equal(versionsInstance.length, 3);
            assert.equal(Version.VersionType.CREATED, versionsInstance[0].version_type);
            assert.equal(Version.VersionType.UPDATED, versionsInstance[1].version_type);
            assert.equal(Version.VersionType.DELETED, versionsInstance[2].version_type);
            
            
            done();
            
        }).catch(err => done(err));

    })

    it ('must support transaction with cls', done => {

        const ERR_MSG = 'ROLLBACK_CLS_TEST';

        const test = async() => {


            try{

                await TestModel.destroy({truncate: true}),
                await VersionModel.destroy({truncate: true}),
                await sequelize.transaction(async() => {

                    return Promise.all([
                         TestModel.build({name: 'test transaction cls'}).save().then(() => Promise.reject(new Error(ERR_MSG))),
                    ]);

                }).catch(async err => {

                    if (err.message === ERR_MSG){
                        const versions = await VersionModel.findAll();
                        assert.equal(versions.length, 0);

                    }else{
                        assert.fail(err);
                    }


                });

            }catch(err){

                return err;

            }


        }


        test().then(result => done(result)).catch(err => done(err));

    });

    it ('Must support custom options', () => {

        const schema = 'test2';
        const prefix = 'version';
        const suffix = 'log';

        const V2 = new Version(TestModel, {schema, prefix, suffix});

        assert.equal(V2.options.schema, schema)
        assert.equal(true, new RegExp(`^${prefix}`).test(V2.options.tableName));
        assert.equal(true, new RegExp(`${suffix}$`).test(V2.options.tableName));

    })

   

});