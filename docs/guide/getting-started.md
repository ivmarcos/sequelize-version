# Getting Started

## Installation

::: code-group

```bash [npm]
npm install sequelize-version
```

```bash [yarn]
yarn add sequelize-version
```

```bash [pnpm]
pnpm add sequelize-version
```

:::

## Requirements

- Node.js >= 16.0.0
- Sequelize >= 3.0.0 (v3, v4, v5, v6, or v7)

## Basic Setup

### 1. Import and Create Version Model

```typescript
import { Version } from 'sequelize-version';
import { Sequelize, DataTypes } from 'sequelize';

// Your Sequelize setup
const sequelize = new Sequelize('database', 'username', 'password', {
  dialect: 'postgres',
});

// Define your model
const User = sequelize.define('User', {
  name: DataTypes.STRING,
  email: DataTypes.STRING,
});

// Create the version model
const UserVersion = Version(User);
```

### 2. Sync Database

```typescript
// This will create both User and UserVersion tables
await sequelize.sync();
```

### 3. That's It!

Now every time you create, update, or delete a User record, a version will be automatically created:

```typescript
// Create - version_type: 1 (CREATED)
const user = await User.create({
  name: 'John',
  email: 'john@example.com',
});

// Update - version_type: 2 (UPDATED)
user.name = 'John Doe';
await user.save();

// Delete - version_type: 3 (DELETED)
await user.destroy();
```

## Querying Versions

### Instance Method

```typescript
const user = await User.findByPk(1);
const versions = await user.getVersions();
```

### Static Method

```typescript
const allVersions = await User.getVersions({
  where: { name: 'John' },
});
```

### Using the Version Model Directly

```typescript
const versions = await UserVersion.findAll({
  where: { id: 1 },
  order: [['version_id', 'DESC']],
});
```

### Using Scopes

```typescript
// Get all created versions
const created = await UserVersion.scope('created').findAll();

// Get all updated versions
const updated = await UserVersion.scope('updated').findAll();

// Get all deleted versions
const deleted = await UserVersion.scope('deleted').findAll();
```

## Version Types

Each version record has a `version_type` field:

| Type | Value | Description |
|------|-------|-------------|
| CREATED | 1 | Record was created |
| UPDATED | 2 | Record was updated |
| DELETED | 3 | Record was deleted |

```typescript
import { VersionType } from 'sequelize-version';

const updates = await UserVersion.findAll({
  where: { version_type: VersionType.UPDATED },
});
```

## Next Steps

- [Configuration Options](/guide/configuration) - Customize table names, excluded fields, and more
- [Custom Attributes](/guide/custom-attributes) - Add userId, IP address, etc.
- [Diff Tool](/guide/diff-tool) - Compare versions
- [Transactions](/guide/transactions) - Transaction support
