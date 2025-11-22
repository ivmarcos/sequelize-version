/**
 * Comprehensive tests for sequelize-version
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { Sequelize, DataTypes, Model } from 'sequelize';
import { Version, VersionType, diffVersions, summarizeDiff } from '../src';

// Test database connection
const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_TEST || 'sequelize_version_test',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PWD || 'postgres',
  logging: false,
});

// Define test model
interface TestAttributes {
  id: number;
  name: string;
  email: string;
  age: number;
  metadata: object | null;
}

class TestModel extends Model<TestAttributes> {
  declare id: number;
  declare name: string;
  declare email: string;
  declare age: number;
  declare metadata: object | null;
  declare getVersions: (options?: any) => Promise<any[]>;
}

TestModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    age: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'tests',
    timestamps: true,
  }
);

// Version model
let VersionModel: any;

describe('sequelize-version', () => {
  beforeAll(async () => {
    // Create version model
    VersionModel = Version(TestModel);

    // Sync database
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    // Clean up before each test
    await VersionModel.destroy({ truncate: true, restartIdentity: true });
    await TestModel.destroy({ truncate: true, restartIdentity: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('Basic Versioning', () => {
    it('should create a version when a record is created', async () => {
      const record = await TestModel.create({
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
      });

      const versions = await VersionModel.findAll({
        where: { id: record.id },
      });

      expect(versions).toHaveLength(1);
      expect(versions[0].version_type).toBe(VersionType.CREATED);
      expect(versions[0].name).toBe('John Doe');
      expect(versions[0].email).toBe('john@example.com');
    });

    it('should create a version when a record is updated', async () => {
      const record = await TestModel.create({
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
      });

      record.name = 'John Updated';
      await record.save();

      const versions = await VersionModel.findAll({
        where: { id: record.id },
        order: [['version_id', 'ASC']],
      });

      expect(versions).toHaveLength(2);
      expect(versions[0].version_type).toBe(VersionType.CREATED);
      expect(versions[1].version_type).toBe(VersionType.UPDATED);
      expect(versions[1].name).toBe('John Updated');
    });

    it('should create a version when a record is deleted', async () => {
      const record = await TestModel.create({
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
      });

      await record.destroy();

      const versions = await VersionModel.findAll({
        where: { id: record.id },
        order: [['version_id', 'ASC']],
      });

      expect(versions).toHaveLength(2);
      expect(versions[1].version_type).toBe(VersionType.DELETED);
    });

    it('should handle bulk create', async () => {
      await TestModel.bulkCreate([
        { name: 'User 1', email: 'user1@example.com', age: 25 },
        { name: 'User 2', email: 'user2@example.com', age: 35 },
      ]);

      const versions = await VersionModel.findAll();

      expect(versions).toHaveLength(2);
      expect(versions.every((v: any) => v.version_type === VersionType.CREATED)).toBe(true);
    });
  });

  describe('Instance Methods', () => {
    it('should add getVersions method to instances', async () => {
      const record = await TestModel.create({
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
      });

      record.name = 'John Updated';
      await record.save();

      const versions = await record.getVersions();

      expect(versions).toHaveLength(2);
    });

    it('should support query options in getVersions', async () => {
      const record = await TestModel.create({
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
      });

      record.name = 'John Updated';
      await record.save();

      const versions = await record.getVersions({
        where: { version_type: VersionType.UPDATED },
      });

      expect(versions).toHaveLength(1);
      expect(versions[0].name).toBe('John Updated');
    });
  });

  describe('Static Methods', () => {
    it('should add getVersions static method to source model', async () => {
      await TestModel.create({ name: 'User 1', email: 'user1@example.com', age: 25 });
      await TestModel.create({ name: 'User 2', email: 'user2@example.com', age: 35 });

      const versions = await (TestModel as any).getVersions();

      expect(versions).toHaveLength(2);
    });
  });

  describe('Scopes', () => {
    it('should provide created scope', async () => {
      const record = await TestModel.create({
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
      });

      record.name = 'John Updated';
      await record.save();
      await record.destroy();

      const created = await VersionModel.scope('created').findAll();

      expect(created).toHaveLength(1);
      expect(created[0].name).toBe('John Doe');
    });

    it('should provide updated scope', async () => {
      const record = await TestModel.create({
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
      });

      record.name = 'John Updated';
      await record.save();

      const updated = await VersionModel.scope('updated').findAll();

      expect(updated).toHaveLength(1);
      expect(updated[0].name).toBe('John Updated');
    });

    it('should provide deleted scope', async () => {
      const record = await TestModel.create({
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
      });

      await record.destroy();

      const deleted = await VersionModel.scope('deleted').findAll();

      expect(deleted).toHaveLength(1);
    });
  });

  describe('Transactions', () => {
    it('should rollback versions with transaction', async () => {
      try {
        await sequelize.transaction(async (t) => {
          await TestModel.create(
            { name: 'John Doe', email: 'john@example.com', age: 30 },
            { transaction: t }
          );
          throw new Error('Rollback test');
        });
      } catch (error) {
        // Expected error
      }

      const versions = await VersionModel.findAll();
      expect(versions).toHaveLength(0);
    });
  });

  describe('Custom Options', () => {
    it('should support custom prefix and suffix', async () => {
      const CustomModel = sequelize.define(
        'custom_test',
        {
          id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
          name: { type: DataTypes.STRING },
        },
        { timestamps: false }
      );

      const CustomVersionModel = Version(CustomModel, {
        prefix: 'audit',
        suffix: 'log',
      });

      expect(CustomVersionModel.name).toBe('AuditCustom_testLog');
      expect((CustomVersionModel.options as any).tableName).toBe('audit_custom_test_log');
    });

    it('should support excluding attributes', async () => {
      const SecureModel = sequelize.define(
        'secure_test',
        {
          id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
          name: { type: DataTypes.STRING },
          password: { type: DataTypes.STRING },
        },
        { timestamps: false }
      );

      const SecureVersionModel = Version(SecureModel, {
        exclude: ['password'],
      });

      const attrs = Object.keys(SecureVersionModel.rawAttributes);
      expect(attrs).not.toContain('password');
      expect(attrs).toContain('name');
    });

    it('should support custom sequelize instance', async () => {
      const externalSequelize = new Sequelize({
        dialect: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_TEST || 'sequelize_version_test',
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PWD || 'postgres',
        logging: false,
      });

      const ExternalModel = sequelize.define(
        'external_test',
        {
          id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
          name: { type: DataTypes.STRING },
        },
        { timestamps: false }
      );

      const ExternalVersionModel = Version(ExternalModel, {
        sequelize: externalSequelize,
      });

      expect(ExternalVersionModel.sequelize).toBe(externalSequelize);

      await externalSequelize.close();
    });
  });

  describe('Diff Tool', () => {
    it('should diff two versions', async () => {
      const record = await TestModel.create({
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
      });

      record.name = 'John Updated';
      record.age = 31;
      await record.save();

      const versions = await VersionModel.findAll({
        where: { id: record.id },
        order: [['version_id', 'ASC']],
      });

      const diff = VersionModel.diff(versions[0], versions[1]);

      expect(diff.modified).toHaveProperty('name');
      expect(diff.modified.name.oldValue).toBe('John Doe');
      expect(diff.modified.name.newValue).toBe('John Updated');
      expect(diff.modified).toHaveProperty('age');
      expect(diff.modified.age.oldValue).toBe(30);
      expect(diff.modified.age.newValue).toBe(31);
    });

    it('should summarize diff', async () => {
      const record = await TestModel.create({
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
      });

      record.name = 'John Updated';
      await record.save();

      const versions = await VersionModel.findAll({
        where: { id: record.id },
        order: [['version_id', 'ASC']],
      });

      const diff = VersionModel.diff(versions[0], versions[1]);
      const summary = VersionModel.summarizeDiff(diff);

      expect(summary).toContain('Modified "name": "John Doe" → "John Updated"');
    });

    it('should use standalone diff function', async () => {
      const v1 = { name: 'John', age: 30 };
      const v2 = { name: 'Jane', age: 30 };

      const diff = diffVersions(v1, v2, { versionPrefix: 'version' });

      expect(diff.modified).toHaveProperty('name');
      expect(diff.unchanged).toContain('age');
    });

    it('should get version history with diffs', async () => {
      const record = await TestModel.create({
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
      });

      record.name = 'John Updated';
      await record.save();

      record.age = 31;
      await record.save();

      const history = await VersionModel.getHistory({ id: record.id });

      expect(history).toHaveLength(3);
      expect(history[0].diff).toBeUndefined(); // First version has no diff
      expect(history[1].diff).toBeDefined();
      expect(history[2].diff).toBeDefined();
    });
  });

  describe('Global Defaults', () => {
    it('should support setting global defaults', async () => {
      const originalDefaults = { ...Version.defaults };

      Version.defaults = {
        prefix: 'global_audit',
      };

      const GlobalModel = sequelize.define(
        'global_test',
        {
          id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
          name: { type: DataTypes.STRING },
        },
        { timestamps: false }
      );

      const GlobalVersionModel = Version(GlobalModel);

      expect((GlobalVersionModel.options as any).tableName).toContain('global_audit');

      // Reset defaults
      Version.defaults = originalDefaults;
    });
  });

  describe('Validation', () => {
    it('should throw error if both prefix and suffix are empty', () => {
      const InvalidModel = sequelize.define(
        'invalid_test',
        {
          id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
          name: { type: DataTypes.STRING },
        },
        { timestamps: false }
      );

      expect(() => {
        Version(InvalidModel, { prefix: '', suffix: '' });
      }).toThrow('Prefix or suffix must be provided');
    });
  });

  describe('JSON/Metadata Fields', () => {
    it('should properly version JSON fields', async () => {
      const record = await TestModel.create({
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
        metadata: { role: 'admin', permissions: ['read', 'write'] },
      });

      record.metadata = { role: 'user', permissions: ['read'] };
      await record.save();

      const versions = await VersionModel.findAll({
        where: { id: record.id },
        order: [['version_id', 'ASC']],
      });

      expect(versions[0].metadata).toEqual({ role: 'admin', permissions: ['read', 'write'] });
      expect(versions[1].metadata).toEqual({ role: 'user', permissions: ['read'] });
    });
  });
});

describe('Custom Attributes', () => {
  let CustomVersionModel: any;
  let CustomTestModel: any;

  beforeAll(async () => {
    CustomTestModel = sequelize.define(
      'custom_attr_test',
      {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: DataTypes.STRING },
      },
      { timestamps: false }
    );

    CustomVersionModel = Version(CustomTestModel, {
      customAttributes: {
        userId: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        ipAddress: {
          type: DataTypes.STRING,
          allowNull: true,
        },
      },
      customAttributeResolver: async (_context) => ({
        userId: 123,
        ipAddress: '192.168.1.1',
      }),
    });

    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    await CustomVersionModel.destroy({ truncate: true, restartIdentity: true });
    await CustomTestModel.destroy({ truncate: true, restartIdentity: true });
  });

  it('should include custom attributes in version model', () => {
    const attrs = Object.keys(CustomVersionModel.rawAttributes);
    expect(attrs).toContain('userId');
    expect(attrs).toContain('ipAddress');
  });

  it('should resolve custom attribute values', async () => {
    await CustomTestModel.create({ name: 'Test User' });

    const versions = await CustomVersionModel.findAll();

    expect(versions).toHaveLength(1);
    expect(versions[0].userId).toBe(123);
    expect(versions[0].ipAddress).toBe('192.168.1.1');
  });
});

describe('Track Changed Fields', () => {
  let TrackVersionModel: any;
  let TrackTestModel: any;

  beforeAll(async () => {
    TrackTestModel = sequelize.define(
      'track_changes_test',
      {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: DataTypes.STRING },
        email: { type: DataTypes.STRING },
        age: { type: DataTypes.INTEGER },
      },
      { timestamps: false }
    );

    TrackVersionModel = Version(TrackTestModel, {
      trackChangedFields: true,
    });

    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    await TrackVersionModel.destroy({ truncate: true, restartIdentity: true });
    await TrackTestModel.destroy({ truncate: true, restartIdentity: true });
  });

  it('should include changed fields attribute', () => {
    const attrs = Object.keys(TrackVersionModel.rawAttributes);
    expect(attrs).toContain('version_changed_fields');
  });

  it('should track changed fields on update', async () => {
    const record = await TrackTestModel.create({
      name: 'John',
      email: 'john@example.com',
      age: 30,
    });

    record.name = 'John Updated';
    record.age = 31;
    await record.save();

    const versions = await TrackVersionModel.findAll({
      order: [['version_id', 'ASC']],
    });

    expect(versions).toHaveLength(2);
    // First version (create) should not have changed fields
    expect(versions[0].version_changed_fields).toBeNull();
    // Second version (update) should have changed fields
    expect(versions[1].version_changed_fields).toContain('name');
    expect(versions[1].version_changed_fields).toContain('age');
  });
});
