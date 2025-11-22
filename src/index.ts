/**
 * Sequelize Version
 * Automatically version (audit, log) your Sequelize models
 *
 * @packageDocumentation
 * @module sequelize-version
 *
 * @example
 * ```typescript
 * import { Version, VersionType } from 'sequelize-version';
 *
 * const PersonVersion = new Version(Person, {
 *   customAttributes: {
 *     userId: DataTypes.INTEGER,
 *     ipAddress: DataTypes.STRING,
 *   },
 *   customAttributeResolver: (context) => ({
 *     userId: getCurrentUserId(),
 *     ipAddress: getClientIP(),
 *   }),
 *   trackChangedFields: true,
 * });
 *
 * // Get versions
 * const versions = await person.getVersions();
 *
 * // Compare versions
 * const diff = PersonVersion.diff(versions[0], versions[1]);
 * ```
 */

import type { ModelStatic, Sequelize } from 'sequelize';
import {
  VersionType,
  Hook,
  type VersionOptions,
  type ResolvedVersionOptions,
  type VersionDiff,
  type VersionContext,
  type GetVersionsOptions,
  type CustomAttributeResolver,
  type CustomAttributeDefinitions,
} from './types';
import { isEmpty } from './utils/helpers';
import { buildVersionModel } from './core/version-model-builder';
import { registerVersionHooks } from './core/hook-manager';
import { addSourceModelMethods, addVersionModelMethods } from './core/model-methods';
import { diffVersions, summarizeDiff, isIdentical, getModifiedFields, createPatch } from './core/diff-tool';
import { sequelizeCompat, detectSequelizeVersion, augmentModelForCompat } from './utils/sequelize-compat';

/**
 * Default configuration options
 */
const defaults: ResolvedVersionOptions = {
  prefix: 'version',
  attributePrefix: '',
  suffix: '',
  schema: '',
  exclude: [],
  tableUnderscored: true,
  underscored: true,
  trackChangedFields: false,
  customAttributes: {},
};

/**
 * Global default options that can be modified
 */
let globalDefaults: Partial<VersionOptions> = {};

/**
 * Creates a version model for tracking changes to a Sequelize model
 *
 * @param model - The source Sequelize model to version
 * @param customOptions - Optional configuration options
 * @returns The version model
 *
 * @example
 * ```typescript
 * // Basic usage
 * const PersonVersion = new Version(Person);
 *
 * // With custom options
 * const PersonVersion = new Version(Person, {
 *   prefix: 'audit',
 *   suffix: 'log',
 *   exclude: ['password'],
 * });
 * ```
 */
function Version(
  model: ModelStatic<any>,
  customOptions?: VersionOptions
): ModelStatic<any> {
  // Merge options: defaults < global defaults < custom options
  const mergedOptions: ResolvedVersionOptions = {
    ...defaults,
    ...globalDefaults,
    ...customOptions,
  } as ResolvedVersionOptions;

  // Set attributePrefix to prefix if not explicitly set
  if (!mergedOptions.attributePrefix) {
    mergedOptions.attributePrefix = mergedOptions.prefix;
  }

  // Validate options
  if (isEmpty(mergedOptions.prefix) && isEmpty(mergedOptions.suffix)) {
    throw new Error('Prefix or suffix must be provided in options.');
  }

  // Determine which sequelize instance to use
  const sequelize: Sequelize = mergedOptions.sequelize || (model as any).sequelize;

  // Build the version model
  const versionModel = buildVersionModel(model, mergedOptions, sequelize);

  // Register hooks on the source model
  registerVersionHooks(model, versionModel, mergedOptions, sequelize);

  // Add methods to source model
  addSourceModelMethods(model, versionModel, mergedOptions);

  // Add utility methods to version model
  addVersionModelMethods(versionModel, mergedOptions);

  // Attach VersionType to the version model for convenience
  (versionModel as any).VersionType = VersionType;

  return versionModel;
}

/**
 * Global defaults that apply to all Version instances
 * Can be overridden per-instance
 */
Object.defineProperty(Version, 'defaults', {
  get: () => ({ ...defaults, ...globalDefaults }),
  set: (value: Partial<VersionOptions>) => {
    globalDefaults = value;
  },
  enumerable: true,
  configurable: true,
});

/**
 * Version type enumeration
 */
(Version as any).VersionType = VersionType;

/**
 * Hook enumeration
 */
(Version as any).Hook = Hook;

/**
 * Utility function to compare versions
 */
(Version as any).diff = diffVersions;

/**
 * Utility function to summarize diffs
 */
(Version as any).summarizeDiff = summarizeDiff;

/**
 * Utility function to check if versions are identical
 */
(Version as any).isIdentical = isIdentical;

/**
 * Utility function to get modified field names
 */
(Version as any).getModifiedFields = getModifiedFields;

/**
 * Utility function to create a patch from diff
 */
(Version as any).createPatch = createPatch;

/**
 * Detect Sequelize version
 */
(Version as any).detectSequelizeVersion = detectSequelizeVersion;

/**
 * Compatibility utilities
 */
(Version as any).compat = sequelizeCompat;

/**
 * Augment model for backward compatibility
 */
(Version as any).augmentModel = augmentModelForCompat;

// Export the main function and types
export default Version;
export {
  Version,
  VersionType,
  Hook,
  diffVersions,
  summarizeDiff,
  isIdentical,
  getModifiedFields,
  createPatch,
  detectSequelizeVersion,
  sequelizeCompat,
  augmentModelForCompat,
};

// Export types
export type {
  VersionOptions,
  VersionDiff,
  VersionContext,
  GetVersionsOptions,
  CustomAttributeResolver,
  CustomAttributeDefinitions,
  ResolvedVersionOptions,
};
