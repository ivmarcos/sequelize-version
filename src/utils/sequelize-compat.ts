/**
 * Sequelize version compatibility layer
 * Handles differences between Sequelize v3, v4, v5, v6, and v7
 */

import type { ModelStatic, Sequelize } from 'sequelize';
import type { SequelizeCompat } from '../types';

/**
 * Detects the major version of Sequelize being used
 * @param sequelize - Sequelize instance or constructor
 * @returns Major version number (3, 4, 5, 6, or 7)
 */
export function detectSequelizeVersion(sequelize: any): number {
  // Check for version property
  if (sequelize.version) {
    const major = parseInt(sequelize.version.split('.')[0] ?? '6', 10);
    return major;
  }

  // Sequelize v7 has specific features
  if (sequelize.fn && typeof sequelize.fn === 'function') {
    // v7 uses ESM and has different structure
    try {
      if ('importModels' in sequelize || sequelize.constructor.name === 'Sequelize') {
        // Check for v7-specific features
        if (sequelize.models && typeof sequelize.models === 'object') {
          return 7;
        }
      }
    } catch {
      // Continue to other checks
    }
  }

  // Check for v6+ features (useCLS is a static method)
  if (typeof sequelize.constructor.useCLS === 'function') {
    return 6;
  }

  // Check for v5 features
  if (sequelize.Sequelize && typeof sequelize.Sequelize.useCLS === 'function') {
    return 5;
  }

  // Check for v4 features (cls property on Sequelize constructor)
  if ('cls' in (sequelize.Sequelize || sequelize.constructor)) {
    return 4;
  }

  // Default to v3
  return 3;
}

/**
 * Gets raw attributes from a model, handling version differences
 * - v3: model.attributes
 * - v4+: model.rawAttributes
 */
function getRawAttributes(model: ModelStatic<any>): Record<string, any> {
  // v4+ uses rawAttributes
  if ('rawAttributes' in model && model.rawAttributes) {
    return model.rawAttributes;
  }

  // v3 uses attributes
  if ('attributes' in model) {
    return (model as any).attributes || {};
  }

  return {};
}

/**
 * Gets the CLS namespace, handling version differences
 * - v3: Sequelize.cls (set directly)
 * - v4-v5: Sequelize.cls (set via useCLS)
 * - v6-v7: Sequelize.useCLS() returns the namespace
 */
function getCLS(sequelize: Sequelize, namespace?: any): any {
  // If namespace is explicitly provided, use it
  if (namespace) {
    return namespace;
  }

  const SequelizeConstructor = (sequelize as any).Sequelize || sequelize.constructor;

  // Check for cls property (v3-v5)
  if ('cls' in SequelizeConstructor) {
    return SequelizeConstructor.cls;
  }

  // v6+ stores it differently
  if ('_cls' in SequelizeConstructor) {
    return SequelizeConstructor._cls;
  }

  return undefined;
}

/**
 * Gets the model name, handling version differences
 */
function getModelName(model: ModelStatic<any>): string {
  // v4+ uses model.name
  if (model.name) {
    return model.name;
  }

  // v3 might use different property
  if ((model as any).modelName) {
    return (model as any).modelName;
  }

  // Fallback to options
  if (model.options && (model.options as any).name) {
    const nameOption = (model.options as any).name;
    return typeof nameOption === 'string' ? nameOption : nameOption.singular || 'Model';
  }

  return 'Model';
}

/**
 * Gets the table name, handling version differences
 */
function getTableName(model: ModelStatic<any>): string {
  // Check options first (most reliable)
  if (model.options && (model.options as any).tableName) {
    return (model.options as any).tableName;
  }

  // v4+ uses getTableName()
  if (typeof model.getTableName === 'function') {
    const tableName = model.getTableName();
    return typeof tableName === 'string' ? tableName : tableName.tableName || getModelName(model);
  }

  // Fallback to model name
  return getModelName(model);
}

/**
 * Creates a compatibility layer instance
 */
export function createSequelizeCompat(): SequelizeCompat {
  return {
    getRawAttributes,
    getCLS,
    getModelName,
    getTableName,
  };
}

/**
 * Default compatibility layer instance
 */
export const sequelizeCompat = createSequelizeCompat();

/**
 * Augments a model with methods for Sequelize v5+ compatibility
 * This is useful when testing with older Sequelize versions
 *
 * @param model - Model to augment
 * @returns Augmented model
 */
export function augmentModelForCompat<T extends ModelStatic<any>>(model: T): T {
  // Add findOne if only find exists (v3)
  if ((model as any).find && !(model as any).findOne) {
    (model as any).findOne = (model as any).find;
  }

  // Add findAll if only all exists (v3)
  if ((model as any).all && !(model as any).findAll) {
    (model as any).findAll = (model as any).all;
  }

  // Add rawAttributes if only attributes exists (v3)
  if ((model as any).attributes && !model.rawAttributes) {
    (model as any).rawAttributes = (model as any).attributes;
  }

  return model;
}

/**
 * Checks if the Sequelize instance supports async CLS
 * v6+ uses cls-hooked or AsyncLocalStorage
 */
export function supportsAsyncCLS(sequelize: Sequelize): boolean {
  const version = detectSequelizeVersion(sequelize);
  return version >= 6;
}

/**
 * Gets transaction from CLS if available
 *
 * @param sequelize - Sequelize instance
 * @param namespace - Optional CLS namespace
 * @param explicitTransaction - Explicitly passed transaction
 * @returns Transaction if found
 */
export function getTransactionFromCLS(
  sequelize: Sequelize,
  namespace?: any,
  explicitTransaction?: any
): any {
  // Explicit transaction takes precedence
  if (explicitTransaction) {
    return explicitTransaction;
  }

  // Try to get from CLS
  const cls = getCLS(sequelize, namespace);
  if (cls && typeof cls.get === 'function') {
    return cls.get('transaction');
  }

  return undefined;
}
