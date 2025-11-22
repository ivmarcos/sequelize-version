/**
 * Utility functions for sequelize-version
 * Pure functions with no side effects for better testability
 */

/**
 * Capitalizes the first letter of a string
 * @param str - String to capitalize
 * @returns Capitalized string
 * @example capitalize('hello') => 'Hello'
 */
export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Converts a value to an array
 * @param value - Value to convert
 * @returns Array containing the value, or the value if already an array
 * @example toArray('a') => ['a'], toArray(['a']) => ['a']
 */
export function toArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

/**
 * Deep clones a value using JSON serialization
 * Note: This will not preserve functions, undefined, or circular references
 * @param value - Value to clone
 * @returns Deep cloned value
 */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Checks if a value is empty (undefined, null, NaN, or empty string)
 * @param value - Value to check
 * @returns True if the value is considered empty
 */
export function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'number' && isNaN(value)) || value === '';
}

/**
 * Clones specific attributes from a Sequelize model's attribute definitions
 * Used to create version model attributes based on the source model
 *
 * @param attributes - Source model attributes
 * @param attrsToClone - List of attribute properties to clone (e.g., ['type', 'field'])
 * @param excludeAttrs - List of attribute names to exclude
 * @returns Cloned attributes object
 */
export function cloneModelAttributes(
  attributes: Record<string, any>,
  attrsToClone: string[],
  excludeAttrs: string[]
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const attrName in attributes) {
    // Skip excluded attributes
    if (excludeAttrs.includes(attrName)) continue;

    const sourceAttr = attributes[attrName];
    const clonedAttr: Record<string, any> = {};

    // Clone only specified properties
    for (const propName of attrsToClone) {
      if (propName in sourceAttr) {
        clonedAttr[propName] = sourceAttr[propName];
      }
    }

    result[attrName] = clonedAttr;
  }

  return result;
}

/**
 * Generates a version table name based on configuration
 *
 * @param modelName - Source model name
 * @param prefix - Table name prefix
 * @param suffix - Table name suffix
 * @param underscored - Whether to use underscores as separators
 * @returns Generated table name
 * @example generateTableName('User', 'version', '', true) => 'version_User'
 */
export function generateTableName(
  modelName: string,
  prefix: string,
  suffix: string,
  underscored: boolean
): string {
  const separator = underscored ? '_' : '';
  const prefixPart = prefix ? `${prefix}${separator}` : '';
  const suffixPart = suffix ? `${separator}${suffix}` : '';
  return `${prefixPart}${modelName}${suffixPart}`;
}

/**
 * Generates a version model name
 *
 * @param modelName - Source model name
 * @param prefix - Name prefix
 * @param suffix - Name suffix
 * @returns Generated model name in PascalCase
 * @example generateModelName('User', 'version', 'history') => 'VersionUserHistory'
 */
export function generateModelName(
  modelName: string,
  prefix: string,
  suffix: string
): string {
  return `${capitalize(prefix)}${capitalize(modelName)}${capitalize(suffix)}`;
}

/**
 * Generates version attribute field names based on configuration
 *
 * @param prefix - Attribute prefix
 * @param underscored - Whether to use underscores
 * @returns Object with field names for id, type, and timestamp
 */
export function generateVersionFieldNames(
  prefix: string,
  underscored: boolean
): { id: string; type: string; timestamp: string } {
  if (underscored) {
    return {
      id: `${prefix}_id`,
      type: `${prefix}_type`,
      timestamp: `${prefix}_timestamp`,
    };
  }
  return {
    id: `${prefix}Id`,
    type: `${prefix}Type`,
    timestamp: `${prefix}Timestamp`,
  };
}

/**
 * Computes the difference between two objects
 * Used for tracking changed fields between versions
 *
 * @param oldObj - Previous state
 * @param newObj - Current state
 * @param excludeKeys - Keys to exclude from comparison
 * @returns Object containing added, removed, modified, and unchanged fields
 */
export function computeObjectDiff(
  oldObj: Record<string, any>,
  newObj: Record<string, any>,
  excludeKeys: string[] = []
): {
  added: Record<string, any>;
  removed: Record<string, any>;
  modified: Record<string, { oldValue: any; newValue: any }>;
  unchanged: string[];
} {
  const added: Record<string, any> = {};
  const removed: Record<string, any> = {};
  const modified: Record<string, { oldValue: any; newValue: any }> = {};
  const unchanged: string[] = [];

  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

  for (const key of allKeys) {
    if (excludeKeys.includes(key)) continue;

    const inOld = key in oldObj;
    const inNew = key in newObj;
    const oldValue = oldObj[key];
    const newValue = newObj[key];

    if (!inOld && inNew) {
      added[key] = newValue;
    } else if (inOld && !inNew) {
      removed[key] = oldValue;
    } else if (inOld && inNew) {
      // Deep comparison using JSON serialization
      const oldSerialized = JSON.stringify(oldValue);
      const newSerialized = JSON.stringify(newValue);

      if (oldSerialized !== newSerialized) {
        modified[key] = { oldValue, newValue };
      } else {
        unchanged.push(key);
      }
    }
  }

  return { added, removed, modified, unchanged };
}

/**
 * Gets changed field names from a Sequelize instance
 * Handles different Sequelize versions
 *
 * @param instance - Sequelize model instance
 * @returns Array of changed field names
 */
export function getChangedFields(instance: any): string[] {
  // Sequelize v4+ uses changed()
  if (typeof instance.changed === 'function') {
    const changed = instance.changed();
    return changed ? (Array.isArray(changed) ? changed : []) : [];
  }

  // Sequelize v3 uses _changed
  if (instance._changed) {
    return Object.keys(instance._changed).filter(key => instance._changed[key]);
  }

  return [];
}
