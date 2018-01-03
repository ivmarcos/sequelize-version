require('dotenv').config();
const assert = require('assert');
const Version = require('../index');
const Sequelize = require('sequelize');
const cls = require('continuation-local-storage');
const namespace = cls.createNamespace('my-very-own-namespace');
const env = process.env;
const consoleWarnQueues = [];

function wrapConsoleWarn(){
    console.warn = function(message){
        consoleWarnQueues.push(message);
        console.log.apply(console, arguments);
    }
}

function useCLS(Sequelize, namespace){
    if (Sequelize.useCLS){
        Sequelize.useCLS(namespace);
    }else{
        Sequelize.cls = namespace;
    }
}

function clone(instance){
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
    parent_id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        defaultValue: 1,
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

    });


    it ('all hooks working', done => {

        const test = async() => {

            try{

                let testInstance = await TestModel.build({name: 'test'}).save();
                testInstance.name = 'test changed';

                await testInstance.save();
                await testInstance.destroy();
                
                const testInstance2 = await TestModel.create({name: 'test 2'});
                await testInstance2.update({name: 'test 2 with update'});

                await TestModel.bulkCreate([
                    {name: 'bulk test1'},
                    {name: 'bulk test2'}
                ]);
                                
                return await VersionModel.findAll();

            }catch(err){

                return err;
            }

        }

        test().then(result => {

            if (typeof result === 'error' || !Array.isArray(result)) {
                done(result);
            }else{

                assert.equal(result.length, 7);
                assert.equal(Version.VersionType.CREATED, result[0].version_type);
                assert.equal(Version.VersionType.UPDATED, result[1].version_type);
                assert.equal(Version.VersionType.DELETED, result[2].version_type);
                done();
            }
            
        }).catch(err => done(err));

    })

    it ('must support transaction', done => {

        const ERR_MSG = 'ROLLBACK_TEST';

        const test = async() => {


            try{

                await sequelize.transaction(transaction => {

                    return TestModel.build({name: 'test transaction'}).save({transaction}).then(() => Promise.reject(new Error(ERR_MSG)));

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

    it('must support cls transaction', done => {

        useCLS(Sequelize, namespace);

        const ERR_MSG = 'ROLLBACK_CLS_TEST';

        const test = async() => {


            try{

                await sequelize.transaction(() => {

                    return TestModel.build({name: 'test transaction with cls'}).save().then(() => Promise.reject(new Error(ERR_MSG)));

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
    })
    

    it ('must support custom options', done => {

        const sequelize2 = new Sequelize(env.DB_TEST, env.DB_USER, env.DB_PWD, {
            logging: console.log,
            dialect: 'postgres',
        });   

        useCLS(Sequelize, namespace);

        const customOptions = {
            schema: 'test2',
            prefix: 'audit',
            suffix: 'log',
            exclude: ['createdAt', 'updatedAt'],
            attributePrefix: 'revision',
            namespace,
            sequelize: sequelize2
        };

        const V2 = new Version(TestModel, customOptions);

        assert.equal(V2.options.schema, customOptions.schema)
        assert.equal(true, new RegExp(`^${customOptions.prefix}`).test(V2.options.tableName));
        assert.equal(true, new RegExp(`${customOptions.suffix}$`).test(V2.options.tableName));

        const versionAttributes = Object.keys(V2.attributes).filter(attr => attr.match(new RegExp(`^${customOptions.attributePrefix}`)));

        assert.equal(3, versionAttributes.length);

        const test = async() => {

            try{
                
                await sequelize.query(`CREATE SCHEMA IF NOT EXISTS ${customOptions.schema}`);

                await V2.sync({force: true});

                const testInstance = await TestModel.build({name: 'test'}).save();

                return Promise.all([
                    VersionModel.findAll({where: {id: testInstance.id}}),
                    V2.findAll({where: {id: testInstance.id}}),
                    Promise.resolve(testInstance),
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
            const attributesVersion = Object.keys(V2.attributes);

            const attributesCloned = attributes.filter(attr => customOptions.exclude.indexOf(attr) === -1);

            assert.equal(attributesCloned.length, attributes.length - customOptions.exclude.length);
            assert.equal(attributesVersion.length, attributes.length - customOptions.exclude.length + 3)
            assert.equal(vs1.length, 1);
            assert.equal(vs2.length, 1)
            
            attributesCloned.forEach(attr => {
                assert.deepEqual(vs1[0][attr], testInstance[attr])
                assert.deepEqual(vs2[0][attr], testInstance[attr])
            });
            
            done();

        }).catch(err => done(err));

    });

    it ('must support global options', done => {

        const sequelize2 = new Sequelize(env.DB_TEST, env.DB_USER, env.DB_PWD, {
            logging: console.log,
            dialect: 'postgres',
        });   

        const customOptions = {
            schema: 'test2',
            prefix: 'audit',
            suffix: 'log',
            exclude: ['createdAt', 'updatedAt'],
            attributePrefix: 'revision',
            sequelize: sequelize2
        };

        Version.defaults = customOptions;

        const V2 = new Version(TestModel);

        assert.equal(V2.options.schema, customOptions.schema)
        assert.equal(true, new RegExp(`^${customOptions.prefix}`).test(V2.options.tableName));
        assert.equal(true, new RegExp(`${customOptions.suffix}$`).test(V2.options.tableName));

        const test = async() => {

            try{
                
                await sequelize.query(`CREATE SCHEMA IF NOT EXISTS ${customOptions.schema}`);

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
            const attributesVersion = Object.keys(V2.attributes);

            const attributesCloned = attributes.filter(attr => customOptions.exclude.indexOf(attr) === -1);

            assert.equal(attributesCloned.length, attributes.length - customOptions.exclude.length);
            assert.equal(attributesVersion.length, attributes.length - customOptions.exclude.length + 3)

            const versionAttributes = Object.keys(V2.attributes).filter(attr => attr.match(new RegExp(`^${customOptions.attributePrefix}`)));

            assert.equal(3, versionAttributes.length);
            
            attributesCloned.forEach(attr => {
                assert.deepEqual(vs1[0][attr], testInstance[attr])
                assert.deepEqual(vs2[0][attr], testInstance[attr])
            });
            
            done();

        }).catch(err => done(err));

    });

    it ('version scopes must be working', done => {

         const test = async() => {

            try{
                
                const testInstance = await TestModel.build({name: 'test'}).save();
                
                testInstance.name = 'test 2';
                
                await testInstance.save();

                await testInstance.destroy();

                const result = await Promise.all([
                  VersionModel.scope('created').all(),
                  VersionModel.scope('updated').all(),
                  VersionModel.scope('deleted').all(),
                  VersionModel.scope('created').find({where : {id: testInstance.id}})
                ]);    

                return result;
                                    
            }catch(err){

                return err;
            }

        }

         test().then(result => {

            if (typeof result === 'error') return done(result);

            const created = result[0];
            const updated = result[1];
            const deleted = result[2];
            const createdSingle = result[3];

            assert.equal(1, created.length);
            assert.equal(1, created[0].version_type)
            assert.equal(1, updated.length)
            assert.equal(2, updated[0].version_type);
            assert.equal(1, deleted.length);
            assert.equal(3, deleted[0].version_type);

            assert.deepEqual(clone(created[0]), clone(createdSingle));

            done();

        }).catch(err => done(err));

    });

    it ('getVersions function instance and class methods', done => {


         const test = async() => {

            try{
                
                const testInstance = await TestModel.build({name: 'test with getVersions'}).save();

                const testInstance2 = await TestModel.build({name: 'test 2 with getVersions'}).save();
                
                await testInstance2.destroy();

                if (!testInstance.getVersions) return Promise.reject(new Error('no instance function'))
                        
                return Promise.all([
                    testInstance.getVersions(),
                    TestModel.getVersions(),
                    testInstance.getVersions({where : {name: {like: '%test%'}}}),
                    TestModel.getVersions({where : {name: {like: '%test 2%'}}}),
                ]);    

            }catch(err){

                return err;
            }

        }

         test().then(result => {

            if (typeof result === 'error') return done(result);

            const instanceVersions = result[0];
            const allVersions = result[1];
            const instanceVersionsWithParams = result[2];
            const versionsWithParams = result[3];

            assert.equal(1, instanceVersions.length);
            assert.equal(3, allVersions.length);
            assert.equal(1, instanceVersionsWithParams.length);
            assert.equal(2, versionsWithParams.length);

          
            done();

        }).catch(err => done(err));

    });

    it('Must warn when using methods not supported', done => {

       const test = async() => {

            try{
                
                const testInstance = await TestModel.build({name: 'test with getVersions'}).save();

                const testInstance2 = await TestModel.upsert({id: 2, name: 'test2'});
              
                return ;

            }catch(err){

                return err;
            }

        }

        test.then(() => {
            assert.equal(1, consoleWarnQueues.length);
            done();
        }).catch(err = done(err));

    })
   

});