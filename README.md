# sequelize-version

[![npm version](https://img.shields.io/npm/v/sequelize-version.svg)](https://www.npmjs.com/package/sequelize-version)
[![npm downloads](https://img.shields.io/npm/dm/sequelize-version.svg)](https://www.npmjs.com/package/sequelize-version)
[![CI](https://github.com/ivmarcos/sequelize-version/actions/workflows/ci.yml/badge.svg)](https://github.com/ivmarcos/sequelize-version/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/ivmarcos/sequelize-version/branch/master/graph/badge.svg)](https://codecov.io/gh/ivmarcos/sequelize-version)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Sequelize](https://img.shields.io/badge/Sequelize-v3--v7-green.svg)](https://sequelize.org/)

Automatically version (audit, log) your Sequelize models, tracking all changes (create, update, delete) with TypeScript support.

📖 **[Full Documentation](https://ivmarcos.github.io/sequelize-version)**

## Features

- 📝 **Automatic Versioning** - Track every create, update, and delete
- 🔍 **Diff Tool** - Compare versions to see exactly what changed
- 👤 **Custom Attributes** - Add userId, IP address, changedFields, etc.
- 🔒 **Transaction Support** - Full support including CLS
- 📦 **TypeScript First** - Complete type definitions
- 🔄 **Sequelize v3-v7** - Compatible with all major versions

## Installation

```bash
npm install sequelize-version
```

## Quick Start

```typescript
import { Version, VersionType } from 'sequelize-version';
import { Sequelize, DataTypes } from 'sequelize';

const sequelize = new Sequelize('database', 'user', 'password', {
  dialect: 'postgres',
});

const User = sequelize.define('User', {
  name: DataTypes.STRING,
  email: DataTypes.STRING,
});

// Create version model
const UserVersion = Version(User);

// Sync database
await sequelize.sync();

// Changes are automatically tracked
const user = await User.create({ name: 'John', email: 'john@example.com' });

user.name = 'John Doe';
await user.save();

// Query versions
const versions = await user.getVersions();
// or
const allVersions = await User.getVersions({ where: { name: 'John Doe' } });
```

## Options

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `prefix` | `string` | `'version'` | Table name and attribute prefix |
| `suffix` | `string` | `''` | Table name suffix |
| `attributePrefix` | `string` | value of `prefix` | Override prefix for attributes |
| `schema` | `string` | `''` | Database schema |
| `sequelize` | `Sequelize` | source model's | External Sequelize instance |
| `exclude` | `string[]` | `[]` | Attributes to exclude |
| `tableUnderscored` | `boolean` | `true` | Use underscores in table name |
| `underscored` | `boolean` | `true` | Use underscores in attributes |
| `customAttributes` | `object` | `{}` | Additional version attributes |
| `customAttributeResolver` | `function` | - | Resolve custom attribute values |
| `trackChangedFields` | `boolean` | `false` | Track which fields changed |

## Custom Attributes

Track who made changes and from where:

```typescript
const UserVersion = Version(User, {
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
  customAttributeResolver: (context) => ({
    userId: getCurrentUserId(),
    ipAddress: getClientIP(),
  }),
  trackChangedFields: true,
});
```

## Diff Tool

Compare versions to see what changed:

```typescript
const versions = await UserVersion.findAll({
  where: { id: userId },
  order: [['version_id', 'ASC']],
});

const diff = UserVersion.diff(versions[0], versions[1]);

console.log(diff.modified);
// { name: { oldValue: 'John', newValue: 'John Doe' } }

const summary = UserVersion.summarizeDiff(diff);
// ['Modified "name": "John" → "John Doe"']

// Get full history with diffs
const history = await UserVersion.getHistory({ id: userId });
```

## Scopes

Built-in scopes for filtering:

```typescript
const created = await UserVersion.scope('created').findAll();
const updated = await UserVersion.scope('updated').findAll();
const deleted = await UserVersion.scope('deleted').findAll();
```

## Transactions

Versions respect transactions:

```typescript
await sequelize.transaction(async (t) => {
  const user = await User.create({ name: 'John' }, { transaction: t });
  // Version is created within the same transaction
  // If transaction rolls back, version is also rolled back
});
```

## Global Defaults

Set defaults for all Version calls:

```typescript
Version.defaults = {
  prefix: 'audit',
  exclude: ['password', 'token'],
};
```

## TypeScript

Full TypeScript support with type definitions:

```typescript
import {
  Version,
  VersionType,
  VersionOptions,
  VersionDiff,
  VersionContext
} from 'sequelize-version';
```

## Documentation

📖 **[Full Documentation](https://ivmarcos.github.io/sequelize-version)**

- [Getting Started](https://ivmarcos.github.io/sequelize-version/guide/getting-started)
- [Custom Attributes](https://ivmarcos.github.io/sequelize-version/guide/custom-attributes)
- [Diff Tool](https://ivmarcos.github.io/sequelize-version/guide/diff-tool)
- [API Reference](https://ivmarcos.github.io/sequelize-version/api/)

## Important Notes

When using bulk methods like `Model.destroy()` or `Model.update()`, you need to enable `individualHooks: true` to track changes:

```typescript
await User.destroy({
  where: { status: 'inactive' },
  individualHooks: true, // Required for versioning
});

await User.update(
  { status: 'active' },
  {
    where: { id: 1 },
    individualHooks: true, // Required for versioning
  }
);
```

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests.

## License

MIT © [Marcos Vinicius](https://github.com/ivmarcos)
