# API Reference

## Version

The main function for creating version models.

### Signature

```typescript
function Version(
  model: ModelStatic<any>,
  options?: VersionOptions
): ModelStatic<any>
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | `ModelStatic<any>` | The Sequelize model to version |
| `options` | `VersionOptions` | Optional configuration |

### Returns

Returns a Sequelize model for the version table with additional methods.

### Example

```typescript
import { Version } from 'sequelize-version';

const UserVersion = Version(User, {
  prefix: 'audit',
  exclude: ['password'],
});
```

## Version Model Methods

The returned version model includes these additional methods:

### diff(v1, v2, options?)

Compare two version records.

```typescript
const diff = UserVersion.diff(version1, version2);
```

### summarizeDiff(diff)

Create human-readable change descriptions.

```typescript
const summary = UserVersion.summarizeDiff(diff);
// ['Modified "name": "old" → "new"']
```

### isIdentical(diff)

Check if two versions are the same.

```typescript
if (UserVersion.isIdentical(diff)) {
  console.log('No changes');
}
```

### getModifiedFields(diff)

Get list of modified field names.

```typescript
const fields = UserVersion.getModifiedFields(diff);
// ['name', 'email']
```

### createPatch(diff)

Create a patch object from diff.

```typescript
const patch = UserVersion.createPatch(diff);
// { name: 'new value' }
```

### getHistory(where, options?)

Get version history with diffs.

```typescript
const history = await UserVersion.getHistory({ id: 1 });
// [{ version, diff }, ...]
```

## Source Model Methods

The source model receives these methods:

### Model.getVersions(options?)

Static method to query versions.

```typescript
const versions = await User.getVersions({
  where: { name: 'John' }
});
```

### instance.getVersions(options?)

Instance method to get versions for a specific record.

```typescript
const user = await User.findByPk(1);
const versions = await user.getVersions();
```

## Standalone Functions

### diffVersions(v1, v2, options?)

Compare two version records without a version model.

```typescript
import { diffVersions } from 'sequelize-version';

const diff = diffVersions(v1, v2, {
  versionPrefix: 'version',
  exclude: ['updatedAt'],
});
```

### summarizeDiff(diff)

```typescript
import { summarizeDiff } from 'sequelize-version';

const summary = summarizeDiff(diff);
```

### isIdentical(diff)

```typescript
import { isIdentical } from 'sequelize-version';

if (isIdentical(diff)) {
  // no changes
}
```

### getModifiedFields(diff)

```typescript
import { getModifiedFields } from 'sequelize-version';

const fields = getModifiedFields(diff);
```

### createPatch(diff)

```typescript
import { createPatch } from 'sequelize-version';

const patch = createPatch(diff);
```

### detectSequelizeVersion(sequelize)

Detect the major version of Sequelize.

```typescript
import { detectSequelizeVersion } from 'sequelize-version';

const version = detectSequelizeVersion(sequelize);
// 6
```

## Enums

### VersionType

```typescript
import { VersionType } from 'sequelize-version';

VersionType.CREATED // 1
VersionType.UPDATED // 2
VersionType.DELETED // 3
```

### Hook

```typescript
import { Hook } from 'sequelize-version';

Hook.AFTER_CREATE
Hook.AFTER_UPDATE
Hook.AFTER_DESTROY
Hook.AFTER_SAVE
Hook.AFTER_BULK_CREATE
```

## Global Defaults

Set default options for all Version calls:

```typescript
import { Version } from 'sequelize-version';

Version.defaults = {
  prefix: 'audit',
  schema: 'history',
  exclude: ['password', 'token'],
};

// Now all Version() calls will use these defaults
const UserVersion = Version(User);
const PostVersion = Version(Post);
```
