const assert = require('assert');
const Version = require('../index');
const Sequelize = require('sequelize');
//const cls = require('continuation-local-storage');
const env = process.env;

//const namespace = cls.createNamespace('my-very-own-namespace');
//Sequelize.useCLS(namespace);

function getRawData(instance){
    return JSON.parse(JSON.stringify(instance));
}

function getVersionFields(prefix){
    const versionFieldId = `${prefix}_id`;
    const versionFieldType = `${prefix}_type`;
    const versionFieldTimestamp = `${prefix}_timestamp`;
    return [versionFieldId, versionFieldType, versionFieldTimestamp];
}

const sequelize = new Sequelize(env.DB_TEST, env.DB_USER, env.DB_PWD, {
    logging: console.log,
    dialect: 'postgres',
});    

const TestModel = sequelize.define('test', {
    id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
    },
    name: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'test defaultValue',
        unique: true,
    },
    simple: Sequelize.STRING,
    createdAt: Sequelize.DATE,
});

const VersionModel = new Version(TestModel);

const versionFields = getVersionFields(Version.defaults.prefix);

before(done => {

    sequelize.sync({force: true}).then(() => done()).catch(err => done(err));

});

describe('sequelize-version', () => {

    beforeEach(done => {
        Promise.all([
            TestModel.destroy({truncate : true, restartIdentity: true}),
            VersionModel.destroy({truncate: true, restartIdentity: true})
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

                const attributes = Object.keys(TestModel.attributes);
                const versionAttributes = Object.keys(VersionModel.attributes);
                
                attributes.forEach(attr => {
                    assert.deepEqual(versionInstance[attr], testInstance[attr])
                })

                assert.equal(1, versionsInstance.length);
                assert.equal(attributes.length + 3, versionAttributes.length);

                const versionAttrsCreated = versionAttributes.filter(attr => versionFields.includes(attr));

                assert.equal(versionAttrsCreated.length, versionFields.length)


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

                return versionsInstance;
               

            }catch(err){

                return err;
            }

        }

        test().then(result => {

            if (typeof result === 'error') {
                done(result);
            }else{
                assert.equal(result.length, 3);
                assert.equal(Version.VersionType.CREATED, result[0].version_type);
                assert.equal(Version.VersionType.UPDATED, result[1].version_type);
                assert.equal(Version.VersionType.DELETED, result[2].version_type);
                done();
            }

            
            
            
        }).catch(err => done(err));

    })

    it ('must support transaction with cls', done => {

        const ERR_MSG = 'ROLLBACK_CLS_TEST';

        const test = async() => {


            try{

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

    it ('must support custom options', done => {

        const schema = 'test2';
        const prefix = 'audit';
        const suffix = 'log';

        const V2 = new Version(TestModel, {schema, prefix, suffix});

        assert.equal(V2.options.schema, schema)
        assert.equal(true, new RegExp(`^${prefix}`).test(V2.options.tableName));
        assert.equal(true, new RegExp(`${suffix}$`).test(V2.options.tableName));

        const test = async() => {

            try{
                
                await sequelize.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);

                await V2.sync({force: true});

                const testInstance = await TestModel.build({name: 'test'}).save();

                return Promise.all([
                    VersionModel.findAll({where: {id: testInstance.id}}),
                    V2.findAll({where: {id: testInstance.id}}),
                    Promise.resolve(testInstance)
                ]);    
                    
            }catch(err){

                return err;
            }

        }

        test().then(result => {

            if (typeof result === 'error') return done(result);

            const vs1 = result[0];
            const vs2 = result[1];
            const testInstance = result[2];

            const attributes = Object.keys(TestModel.attributes);
            
            attributes.forEach(attr => {
                assert.deepEqual(vs1[0][attr], testInstance[attr])
                assert.deepEqual(vs2[0][attr], testInstance[attr])
            });
            
            done();

        }).catch(err => done(err));

    });


    it ('must support global options', done => {

        const schema = 'test3';
        const prefix = 'version';
        const suffix = 'log';

        Version.defaults.schema = schema;
        Version.defaults.prefix = prefix;
        Version.defaults.suffix = suffix;

        const V3 = new Version(TestModel);

        assert.equal(V3.options.schema, schema)
        assert.equal(true, new RegExp(`^${prefix}`).test(V3.options.tableName));
        assert.equal(true, new RegExp(`${suffix}$`).test(V3.options.tableName));

        const test = async() => {

            try{
                
                await sequelize.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);

                await V3.sync({force: true});

                const testInstance = await TestModel.build({name: 'test'}).save();

                const result = await Promise.all([
                    VersionModel.findAll({where: {id: testInstance.id}}),
                    V3.findAll({where: {id: testInstance.id}}),
                    Promise.resolve(testInstance)
                ]);    

                return result;
                                    
            }catch(err){

                return err;
            }

        }

        test().then(result => {

            if (typeof result === 'error') return done(result);

            const vs1 = result[0];
            const vs2 = result[1];
            const testInstance = result[2];

            const attributes = Object.keys(TestModel.attributes);
            
            attributes.forEach(attr => {
                assert.deepEqual(vs1[0][attr], testInstance[attr])
                assert.deepEqual(vs2[0][attr], testInstance[attr])
            });
            
            done();

        }).catch(err => done(err));

    })

   

});