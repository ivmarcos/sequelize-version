require('dotenv').config();
const assert = require('assert');
const Version = require('../index');
const Sequelize = require('sequelize');
const cls = require('continuation-local-storage');
const namespace = cls.createNamespace('my-very-own-namespace');
const sessionName = 'sequelize-test';
const env = process.env;

async function useCLS(Sequelize, namespace) {
  const session = cls.getNamespace(sessionName);
  return new Promise((resolve) => {
    session.run(() => {
      if (Sequelize.useCLS) {
        Sequelize.useCLS(namespace);
      } else {
        Sequelize.cls = namespace;
      }
      resolve();
    })
  })
}

// sequelize 5 compat
function augmentModelAsSeq5(model) {
  if (model.find && !model.findOne) {
    model.findOne = model.find;
  }
  if (model.all && !model.findAll) {
    model.findAll = model.all;
  }
  if (model.attributes && !model.rawAttributes) {
    model.rawAttributes = model.attributes;
  }

  return model;
}

function clone(instance) {
  return JSON.parse(JSON.stringify(instance));
}

function getVersionFields(prefix) {
  const versionFieldId = `${prefix}_id`;
  const versionFieldType = `${prefix}_type`;
  const versionFieldTimestamp = `${prefix}_timestamp`;
  return [versionFieldId, versionFieldType, versionFieldTimestamp];
}

// http://docs.sequelizejs.com/manual/querying.html#operators-security
const operatorsAliases = {};
if (Sequelize.Op) {
  operatorsAliases.$like = Sequelize.Op.like;
}

const sequelize = new Sequelize(env.DB_TEST, env.DB_USER, env.DB_PWD, {
  logging: console.log,
  dialect: 'postgres',
  operatorsAliases,
});

const TestModel = augmentModelAsSeq5(
  sequelize.define('test', {
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
      defaultValue: 'test',
      unique: true,
    },
    json: {
      type: Sequelize.STRING,
      get() {
        const val = this.getDataValue('json');
        return [undefined, null].includes(val) ? val : JSON.parse(val);
      },
      set(val) {
        [undefined, null].includes(val)
          ? val
          : this.setDataValue('json', JSON.stringify(val));
      },
    },
    simple: Sequelize.STRING,
    createdAt: Sequelize.DATE,
  })
);

const VersionModel = augmentModelAsSeq5(new Version(TestModel));

const versionFields = getVersionFields(Version.defaults.prefix);

before(done => {
  sequelize
    .sync({ force: true })
    .then(() => done())
    .catch(err => done(err));
});

describe('sequelize-version', () => {
  beforeEach(done => {
    Promise.all([
      TestModel.destroy({ truncate: true, restartIdentity: true }),
      VersionModel.destroy({ truncate: true, restartIdentity: true }),
    ])
      .then(() => done())
      .catch(err => done(err));
  });

  it('basic usage', done => {
    const test = async () => {
      try {
        const testInstance = await TestModel.build({
          name: 'test',
          json: { test: { nested: true } },
        }).save();

        const versionInstance = await VersionModel.findOne({
          where: {
            id: testInstance.id,
          },
        });

        const versionsInstance = await VersionModel.findAll({
          where: {
            id: testInstance.id,
          },
        });

        const attributes = Object.keys(TestModel.rawAttributes);
        const versionAttributes = Object.keys(VersionModel.rawAttributes);

        attributes.forEach(attr => {
          assert.deepEqual(versionInstance[attr], testInstance[attr]);
        });

        assert.equal(1, versionsInstance.length);
        assert.equal(attributes.length + 3, versionAttributes.length);

        const versionAttrsCreated = versionAttributes.filter(attr =>
          versionFields.includes(attr)
        );

        assert.equal(versionAttrsCreated.length, versionFields.length);

        const testUniqueJson = {
          newValue: 'ok',
        };

        versionsInstance[0].json = testUniqueJson;

        await versionsInstance[0].save();

        assert.deepEqual(versionsInstance[0].json, testUniqueJson);
      } catch (err) {
        return err;
      }
    };

    test()
      .then(result => done(result))
      .catch(err => done(err));
  });

  it('all hooks working', done => {
    const test = async () => {
      try {
        const testInstance = await TestModel.build({
          name: 'test',
          json: { test: { nested: true } },
        }).save();
        testInstance.name = 'test changed';

        await testInstance.save();
        await testInstance.destroy();

        const testInstance2 = await TestModel.create({ name: 'test 2' });
        await testInstance2.update({ name: 'test 2 with update' });

        await TestModel.bulkCreate([
          { name: 'bulk test1' },
          { name: 'bulk test2' },
        ]);

        return await VersionModel.findAll();
      } catch (err) {
        return err;
      }
    };

    test()
      .then(result => {
        if (typeof result === 'error' || !Array.isArray(result)) {
          done(result);
        } else {
          assert.equal(result.length, 7);
          assert.equal(Version.VersionType.CREATED, result[0].version_type);
          assert.equal(Version.VersionType.UPDATED, result[1].version_type);
          assert.equal(Version.VersionType.DELETED, result[2].version_type);
          done();
        }
      })
      .catch(err => done(err));
  });

  it('must support transaction', done => {
    const ERR_MSG = 'ROLLBACK_TEST';

    const test = async () => {
      try {
        await sequelize
          .transaction(transaction => {
            return TestModel.build({ name: 'test transaction' })
              .save({ transaction })
              .then(() => Promise.reject(new Error(ERR_MSG)));
          })
          .catch(async err => {
            if (err.message === ERR_MSG) {
              const versions = await VersionModel.findAll();
              assert.equal(versions.length, 0);
            } else {
              assert.fail(err);
            }
          });
      } catch (err) {
        return err;
      }
    };

    test()
      .then(result => done(result))
      .catch(err => done(err));
  });

  it('must support cls transaction', done => {

    const ERR_MSG = 'ROLLBACK_CLS_TEST';

    const test = async () => {
      try {
        await sequelize
          .transaction(() => {
            return TestModel.build({ name: 'test transaction with cls' })
              .save()
              .then(() => Promise.reject(new Error(ERR_MSG)));
          })
          .catch(async err => {
            if (err.message === ERR_MSG) {
              const versions = await VersionModel.findAll();
              assert.equal(versions.length, 0);
            } else {
              assert.fail(err);
            }
          });
      } catch (err) {
        return err;
      }
    };

    useCLS(Sequelize, namespace).then(test).then(result => done(result)).catch(err => done(err));
  });

  it('must support custom options', done => {
    const externalSequelize = new Sequelize(
      env.DB_TEST,
      env.DB_USER,
      env.DB_PWD,
      {
        logging: console.log,
        dialect: 'postgres',
      }
    );


    const customOptions = {
      schema: 'test_custom',
      prefix: 'audit',
      suffix: 'log',
      exclude: ['createdAt', 'updatedAt'],
      attributePrefix: 'revision',
      namespace,
      sequelize: externalSequelize,
    };

    const VersionModelWithCustomOptions = augmentModelAsSeq5(
      new Version(TestModel, customOptions)
    );

    assert.equal(VersionModelWithCustomOptions.name, 'AuditTestLog');
    assert.equal(
      VersionModelWithCustomOptions.options.schema,
      customOptions.schema
    );
    assert.equal(
      `${customOptions.prefix}_${TestModel.options.tableName ||
      TestModel.name}_${customOptions.suffix}`,
      VersionModelWithCustomOptions.options.tableName
    );

    const versionAttributes = Object.keys(
      VersionModelWithCustomOptions.rawAttributes
    ).filter(attr =>
      attr.match(new RegExp(`^${customOptions.attributePrefix}_`))
    );

    assert.equal(3, versionAttributes.length);

    const customOptionsWithoutUnderscore = {
      schema: 'test_nounderscore',
      prefix: 'audit',
      suffix: 'log',
      exclude: ['createdAt', 'updatedAt'],
      attributePrefix: 'revision',
      namespace,
      sequelize: externalSequelize,
      tableUnderscored: false,
      underscored: false,
    };

    const VersionModelWithoutUnderscore = augmentModelAsSeq5(
      new Version(TestModel, customOptionsWithoutUnderscore)
    );

    assert.equal(
      VersionModelWithoutUnderscore.options.schema,
      customOptionsWithoutUnderscore.schema
    );
    assert.equal(
      `${customOptionsWithoutUnderscore.prefix}${TestModel.options.tableName ||
      TestModel.name}${customOptionsWithoutUnderscore.suffix}`,
      VersionModelWithoutUnderscore.options.tableName
    );

    const versionAttributesWithoutUnderscore = Object.keys(
      VersionModelWithoutUnderscore.rawAttributes
    ).filter(attr =>
      attr.match(new RegExp(`^${customOptions.attributePrefix}_`))
    );

    assert.equal(0, versionAttributesWithoutUnderscore.length);

    const test = async () => {
      try {
        await sequelize.query(
          `CREATE SCHEMA IF NOT EXISTS ${customOptions.schema}`
        );
        await sequelize.query(
          `CREATE SCHEMA IF NOT EXISTS ${customOptionsWithoutUnderscore.schema}`
        );

        await VersionModelWithCustomOptions.sync({ force: true });
        await VersionModelWithoutUnderscore.sync({ force: true });

        const testInstance = await TestModel.build({
          name: 'test',
          json: { test: { nested: true } },
        }).save();

        return Promise.all([
          VersionModel.findAll({ where: { id: testInstance.id } }),
          VersionModelWithCustomOptions.findAll({
            where: { id: testInstance.id },
          }),
          VersionModelWithoutUnderscore.findAll({
            where: { id: testInstance.id },
          }),
          Promise.resolve(testInstance),
        ]);
      } catch (err) {
        return err;
      }
    };

    useCLS(Sequelize, namespace).then(test).then(result => {
      if (typeof result === 'error') return done(result);

      console.log('result', result);

      const vs1 = result[0];
      const vs2 = result[1];
      const vs3 = result[2];
      const testInstance = result[3];

      const attributes = Object.keys(TestModel.rawAttributes);
      const attributesVersionCustomOptions = Object.keys(
        VersionModelWithCustomOptions.rawAttributes
      );
      const attributesVersionWithoutUnderscore = Object.keys(
        VersionModelWithoutUnderscore.rawAttributes
      );

      const attributesCloned = attributes.filter(
        attr => customOptions.exclude.indexOf(attr) === -1
      );

      assert.equal(
        attributesCloned.length,
        attributes.length - customOptions.exclude.length
      );
      assert.equal(
        attributesVersionCustomOptions.length,
        attributes.length - customOptions.exclude.length + 3
      );
      assert.equal(
        attributesVersionWithoutUnderscore.length,
        attributes.length - customOptionsWithoutUnderscore.exclude.length + 3
      );
      assert.equal(vs1.length, 1);
      assert.equal(vs2.length, 1);
      assert.equal(vs3.length, 1);

      attributesCloned.forEach(attr => {
        assert.deepEqual(vs1[0][attr], testInstance[attr]);
        assert.deepEqual(vs2[0][attr], testInstance[attr]);
        assert.deepEqual(vs3[0][attr], testInstance[attr]);
      });

      done();
    })
      .catch(err => done(err));
  });

  it('must support global options', done => {
    const externalSequelize = new Sequelize(
      env.DB_TEST,
      env.DB_USER,
      env.DB_PWD,
      {
        logging: console.log,
        dialect: 'postgres',
      }
    );

    const customOptions = {
      schema: 'test2',
      prefix: 'audit',
      suffix: 'log',
      exclude: ['createdAt', 'updatedAt'],
      attributePrefix: 'revision',
      sequelize: externalSequelize,
    };

    Version.defaults = customOptions;

    const V2 = augmentModelAsSeq5(new Version(TestModel));

    assert.equal(V2.options.schema, customOptions.schema);
    assert.equal(
      true,
      new RegExp(`^${customOptions.prefix}`).test(V2.options.tableName)
    );
    assert.equal(
      true,
      new RegExp(`${customOptions.suffix}$`).test(V2.options.tableName)
    );

    const test = async () => {
      try {
        await sequelize.query(
          `CREATE SCHEMA IF NOT EXISTS ${customOptions.schema}`
        );

        await V2.sync({ force: true });

        const testInstance = await TestModel.build({ name: 'test' }).save();

        return Promise.all([
          VersionModel.findAll({ where: { id: testInstance.id } }),
          V2.findAll({ where: { id: testInstance.id } }),
          Promise.resolve(testInstance),
        ]);
      } catch (err) {
        return err;
      }
    };

    test()
      .then(result => {
        if (typeof result === 'error') return done(result);

        const vs1 = result[0];
        const vs2 = result[1];
        const testInstance = result[2];

        const attributes = Object.keys(TestModel.rawAttributes);
        const attributesVersion = Object.keys(V2.rawAttributes);

        const attributesCloned = attributes.filter(
          attr => customOptions.exclude.indexOf(attr) === -1
        );

        assert.equal(
          attributesCloned.length,
          attributes.length - customOptions.exclude.length
        );
        assert.equal(
          attributesVersion.length,
          attributes.length - customOptions.exclude.length + 3
        );

        const versionAttributes = Object.keys(V2.rawAttributes).filter(attr =>
          attr.match(new RegExp(`^${customOptions.attributePrefix}`))
        );

        assert.equal(3, versionAttributes.length);

        attributesCloned.forEach(attr => {
          assert.deepEqual(vs1[0][attr], testInstance[attr]);
          assert.deepEqual(vs2[0][attr], testInstance[attr]);
        });

        done();
      })
      .catch(err => done(err));
  });

  it('version scopes must be working', done => {
    const test = async () => {
      try {
        const testInstance = await TestModel.build({
          name: 'test',
          json: { test: { nested: true } },
        }).save();

        testInstance.name = 'test 2';

        await testInstance.save();

        await testInstance.destroy();

        const result = await Promise.all([
          VersionModel.scope('created').findAll(),
          VersionModel.scope('updated').findAll(),
          VersionModel.scope('deleted').findAll(),
          VersionModel.scope('created').findOne({
            where: { id: testInstance.id },
          }),
        ]);

        return result;
      } catch (err) {
        return err;
      }
    };

    test()
      .then(result => {
        if (typeof result === 'error') return done(result);

        const created = result[0];
        const updated = result[1];
        const deleted = result[2];
        const createdSingle = result[3];

        assert.equal(1, created.length);
        assert.equal(1, created[0].version_type);
        assert.equal(1, updated.length);
        assert.equal(2, updated[0].version_type);
        assert.equal(1, deleted.length);
        assert.equal(3, deleted[0].version_type);

        assert.deepEqual(clone(created[0]), clone(createdSingle));

        done();
      })
      .catch(err => done(err));
  });

  it('getVersions function instance and class methods', done => {
    const test = async () => {
      try {
        const testInstance = await TestModel.build({
          name: 'test with getVersions',
          json: { test: { nested: true } },
        }).save();

        const testInstance2 = await TestModel.build({
          name: 'test 2 with getVersions',
          json: { test: { nested: true } },
        }).save();

        await testInstance2.destroy();

        if (!testInstance.getVersions)
          return Promise.reject(new Error('no instance function'));

        return Promise.all([
          testInstance.getVersions(),
          TestModel.getVersions(),
          testInstance.getVersions({ where: { name: { $like: '%test%' } } }),
          TestModel.getVersions({ where: { name: { $like: '%test 2%' } } }),
        ]);
      } catch (err) {
        return err;
      }
    };

    test()
      .then(result => {
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
      })
      .catch(err => done(err));
  });

  it('must validate correctly the options', done => {
    const incorrectOptions = {
      prefix: '',
      suffix: '',
    };
    assert.throws(() => {
      new Version(TestModel, incorrectOptions);
    });
    const incorrectOptions2 = {
      prefix: null,
      suffix: '',
    };
    assert.throws(() => {
      new Version(TestModel, incorrectOptions2);
    });
    done();
  });
});
