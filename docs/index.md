---
layout: home

hero:
  name: Sequelize Version
  text: Automatic Model Versioning
  tagline: Track every change to your Sequelize models with TypeScript support
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/ivmarcos/sequelize-version

features:
  - icon: 📝
    title: Automatic Versioning
    details: Automatically create version records for every create, update, and delete operation using Sequelize hooks.
  - icon: 🔍
    title: Diff Tool
    details: Compare any two versions to see exactly what changed between them with a built-in diff utility.
  - icon: 👤
    title: Custom Attributes
    details: Add custom fields like userId, IP address, or changedFields to track who made changes and from where.
  - icon: 🔒
    title: Transaction Support
    details: Full transaction support including CLS (Continuation Local Storage) for automatic transaction propagation.
  - icon: 📦
    title: TypeScript First
    details: Written in TypeScript with full type definitions for excellent IDE support and type safety.
  - icon: 🔄
    title: Sequelize v3-v7
    details: Compatible with all major Sequelize versions from v3 to the latest v7 alpha.
---

## Quick Start

```bash
npm install sequelize-version
```

```typescript
import { Version } from 'sequelize-version';
import { Sequelize, DataTypes } from 'sequelize';

const sequelize = new Sequelize('sqlite::memory:');

const User = sequelize.define('User', {
  name: DataTypes.STRING,
  email: DataTypes.STRING,
});

// Create version model
const UserVersion = Version(User);

// Now every change is automatically tracked!
const user = await User.create({ name: 'John', email: 'john@example.com' });

user.name = 'John Doe';
await user.save();

// Get all versions
const versions = await user.getVersions();
console.log(versions); // [{ version_type: 1, ... }, { version_type: 2, ... }]

// Compare versions
const diff = UserVersion.diff(versions[0], versions[1]);
console.log(diff.modified);
// { name: { oldValue: 'John', newValue: 'John Doe' } }
```
