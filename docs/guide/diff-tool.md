# Diff Tool

The diff tool allows you to compare two version records and see exactly what changed between them. This is invaluable for audit trails, debugging, and building "what changed" interfaces.

## Basic Usage

### Using Version Model Method

```typescript
const versions = await UserVersion.findAll({
  where: { id: userId },
  order: [['version_id', 'ASC']],
});

const diff = UserVersion.diff(versions[0], versions[1]);

console.log(diff);
// {
//   added: {},
//   removed: {},
//   modified: {
//     name: { oldValue: 'John', newValue: 'John Doe' }
//   },
//   unchanged: ['email', 'age']
// }
```

### Using Standalone Function

```typescript
import { diffVersions } from 'sequelize-version';

const diff = diffVersions(oldVersion, newVersion, {
  versionPrefix: 'version',
  exclude: ['internalField'],
});
```

## Diff Result Structure

```typescript
interface VersionDiff {
  // Fields that were added (present in v2 but not v1)
  added: Record<string, any>;

  // Fields that were removed (present in v1 but not v2)
  removed: Record<string, any>;

  // Fields that were modified
  modified: Record<string, { oldValue: any; newValue: any }>;

  // Field names that didn't change
  unchanged: string[];
}
```

## Utility Functions

### Summarize Diff

Create human-readable descriptions:

```typescript
const diff = UserVersion.diff(v1, v2);
const summary = UserVersion.summarizeDiff(diff);

console.log(summary);
// [
//   'Modified "name": "John" → "John Doe"',
//   'Added "phone": "+1234567890"'
// ]
```

### Check if Identical

```typescript
const diff = UserVersion.diff(v1, v2);

if (UserVersion.isIdentical(diff)) {
  console.log('No changes detected');
}
```

### Get Modified Fields

```typescript
const diff = UserVersion.diff(v1, v2);
const modifiedFields = UserVersion.getModifiedFields(diff);

console.log(modifiedFields);
// ['name', 'email']
```

### Create Patch

Generate an object that can transform v1 to v2:

```typescript
const diff = UserVersion.diff(v1, v2);
const patch = UserVersion.createPatch(diff);

console.log(patch);
// { name: 'John Doe', phone: '+1234567890' }

// Apply the patch
await Model.update(patch, { where: { id: recordId } });
```

## Version History with Diffs

Get the complete history of a record with diffs between consecutive versions:

```typescript
const history = await UserVersion.getHistory({ id: userId });

history.forEach(({ version, diff }, index) => {
  console.log(`Version ${index + 1}:`, version.version_type);

  if (diff) {
    console.log('Changes:', UserVersion.summarizeDiff(diff));
  }
});
```

## Custom Diff Options

### Exclude Fields

```typescript
const diff = diffVersions(v1, v2, {
  exclude: ['updatedAt', 'internalCounter'],
});
```

### Without Unchanged Fields

For performance with large objects:

```typescript
const diff = diffVersions(v1, v2, {
  includeUnchanged: false,
});

// diff.unchanged will be []
```

## Real-World Examples

### Building a Change Log UI

```typescript
async function getChangeLog(recordId: number) {
  const history = await RecordVersion.getHistory({ id: recordId });

  return history.map(({ version, diff }) => ({
    timestamp: version.version_timestamp,
    type: getActionLabel(version.version_type),
    user: version.changedBy,
    changes: diff ? formatChanges(diff) : 'Initial version',
  }));
}

function formatChanges(diff: VersionDiff): string[] {
  const changes: string[] = [];

  for (const [field, values] of Object.entries(diff.modified)) {
    changes.push(`${field}: "${values.oldValue}" → "${values.newValue}"`);
  }

  for (const [field, value] of Object.entries(diff.added)) {
    changes.push(`${field}: added "${value}"`);
  }

  for (const [field, value] of Object.entries(diff.removed)) {
    changes.push(`${field}: removed "${value}"`);
  }

  return changes;
}
```

### Detecting Specific Changes

```typescript
async function wasFieldModified(
  recordId: number,
  fieldName: string,
  afterDate: Date
): Promise<boolean> {
  const versions = await RecordVersion.findAll({
    where: {
      id: recordId,
      version_timestamp: { [Op.gte]: afterDate },
    },
    order: [['version_id', 'ASC']],
  });

  for (let i = 1; i < versions.length; i++) {
    const diff = RecordVersion.diff(versions[i - 1], versions[i]);
    if (fieldName in diff.modified) {
      return true;
    }
  }

  return false;
}
```

### Reverting to Previous Version

```typescript
async function revertToVersion(recordId: number, versionId: number) {
  const targetVersion = await RecordVersion.findByPk(versionId);
  const currentRecord = await Record.findByPk(recordId);

  if (!targetVersion || !currentRecord) {
    throw new Error('Not found');
  }

  // Get the diff and create reverse patch
  const diff = RecordVersion.diff(targetVersion, currentRecord);
  const patch = RecordVersion.createPatch(
    RecordVersion.diff(currentRecord, targetVersion)
  );

  // Apply the patch to revert
  await currentRecord.update(patch);

  return currentRecord;
}
```

## JSON Field Comparison

The diff tool properly handles JSON fields by doing deep comparison:

```typescript
const v1 = {
  name: 'John',
  settings: { theme: 'dark', notifications: true },
};

const v2 = {
  name: 'John',
  settings: { theme: 'light', notifications: true },
};

const diff = diffVersions(v1, v2);

console.log(diff.modified.settings);
// {
//   oldValue: { theme: 'dark', notifications: true },
//   newValue: { theme: 'light', notifications: true }
// }
```
