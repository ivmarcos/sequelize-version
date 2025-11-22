# Custom Attributes

One of the most powerful features of sequelize-version is the ability to add custom attributes to your version records. This allows you to track additional metadata like who made the change, from where, and what exactly changed.

## Adding Custom Attributes

Use the `customAttributes` option to define additional fields:

```typescript
import { Version } from 'sequelize-version';
import { DataTypes } from 'sequelize';

const UserVersion = Version(User, {
  customAttributes: {
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'ID of the user who made this change',
    },
    ipAddress: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'IP address of the client',
    },
    userAgent: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'User agent string',
    },
  },
});
```

## Resolving Attribute Values

Use the `customAttributeResolver` function to provide values at runtime:

```typescript
const UserVersion = Version(User, {
  customAttributes: {
    userId: DataTypes.INTEGER,
    ipAddress: DataTypes.STRING,
  },
  customAttributeResolver: (context) => {
    // Access your request context (e.g., from CLS, AsyncLocalStorage, etc.)
    const currentUser = getCurrentUser();
    const clientIp = getClientIP();

    return {
      userId: currentUser?.id || null,
      ipAddress: clientIp || null,
    };
  },
});
```

### Async Resolver

The resolver can also be async:

```typescript
customAttributeResolver: async (context) => {
  const user = await getCurrentUserAsync();

  return {
    userId: user?.id,
    requestId: getRequestId(),
  };
},
```

## Context Object

The resolver receives a context object with useful information:

```typescript
interface VersionContext {
  // The hook that triggered the version
  hook: Hook;

  // The version type (CREATED, UPDATED, DELETED)
  versionType: VersionType;

  // The Sequelize instance being versioned
  instance: any;

  // The transaction, if any
  transaction?: Transaction;

  // Previous values (for updates)
  previousValues?: Record<string, any>;

  // Changed fields (if trackChangedFields is enabled)
  changedFields?: string[];
}
```

### Example: Conditional Logic

```typescript
customAttributeResolver: (context) => {
  return {
    userId: getCurrentUserId(),
    action: context.versionType === VersionType.DELETED ? 'soft_delete' : 'normal',
    changedBy: context.versionType === VersionType.CREATED ? 'system' : 'user',
  };
},
```

## Tracking Changed Fields

Enable automatic tracking of which fields changed:

```typescript
const UserVersion = Version(User, {
  trackChangedFields: true,
});
```

This adds a `version_changed_fields` attribute that contains an array of field names that were modified:

```typescript
const user = await User.create({ name: 'John', email: 'john@example.com' });

user.name = 'John Doe';
user.email = 'johndoe@example.com';
await user.save();

const versions = await UserVersion.findAll({
  order: [['version_id', 'DESC']],
  limit: 1,
});

console.log(versions[0].version_changed_fields);
// ['name', 'email']
```

## Complete Example: Audit System

```typescript
import { Version, VersionType } from 'sequelize-version';
import { DataTypes } from 'sequelize';
import { AsyncLocalStorage } from 'async_hooks';

// Request context storage
const requestContext = new AsyncLocalStorage<{
  userId: number;
  ip: string;
  requestId: string;
}>();

// Create versioned model with full audit trail
const DocumentVersion = Version(Document, {
  prefix: 'audit',

  customAttributes: {
    changedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
    },
    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    requestId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    reason: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },

  customAttributeResolver: (context) => {
    const ctx = requestContext.getStore();

    return {
      changedBy: ctx?.userId || null,
      ipAddress: ctx?.ip || null,
      requestId: ctx?.requestId || null,
      reason: context.instance.changeReason || null,
    };
  },

  trackChangedFields: true,
});

// Usage in Express middleware
app.use((req, res, next) => {
  const context = {
    userId: req.user?.id,
    ip: req.ip,
    requestId: req.headers['x-request-id'],
  };

  requestContext.run(context, () => next());
});
```

## Querying with Custom Attributes

```typescript
// Find all changes by a specific user
const userChanges = await DocumentVersion.findAll({
  where: { changedBy: userId },
  order: [['version_timestamp', 'DESC']],
});

// Find all changes from a specific IP
const ipChanges = await DocumentVersion.findAll({
  where: { ipAddress: '192.168.1.1' },
});

// Find all updates that modified the 'content' field
const contentUpdates = await DocumentVersion.findAll({
  where: {
    version_type: VersionType.UPDATED,
    version_changed_fields: { [Op.contains]: ['content'] },
  },
});
```
