/**
 * Type definitions for sequelize-version
 * Provides comprehensive type safety for versioning Sequelize models
 */

import type { Model, ModelStatic, Sequelize, Transaction, WhereOptions } from 'sequelize';

/**
 * Version operation types
 * Represents the type of operation that created a version record
 */
export enum VersionType {
  /** Record was created */
  CREATED = 1,
  /** Record was updated */
  UPDATED = 2,
  /** Record was deleted */
  DELETED = 3,
}

/**
 * Sequelize lifecycle hooks used for versioning
 */
export enum Hook {
  AFTER_CREATE = 'afterCreate',
  AFTER_UPDATE = 'afterUpdate',
  AFTER_DESTROY = 'afterDestroy',
  AFTER_SAVE = 'afterSave',
  AFTER_BULK_CREATE = 'afterBulkCreate',
}

/**
 * Configuration options for the Version plugin
 */
export interface VersionOptions {
  /**
   * Prefix for the version table name
   * @default 'version'
   * @example 'audit' results in 'audit_users' for a 'users' table
   */
  prefix?: string;

  /**
   * Suffix for the version table name
   * @default ''
   * @example 'history' results in 'users_history'
   */
  suffix?: string;

  /**
   * Prefix for version-specific attributes (version_id, version_type, etc.)
   * If not set, uses the value of `prefix`
   * @default value of prefix
   */
  attributePrefix?: string;

  /**
   * Database schema for the version table
   * Uses the source model's schema if not specified
   * @default ''
   */
  schema?: string;

  /**
   * Sequelize instance to use for the version model
   * Uses the source model's instance if not specified
   */
  sequelize?: Sequelize;

  /**
   * Continuation Local Storage namespace for transaction handling
   * @see https://sequelize.org/docs/v6/other-topics/transactions/#automatically-pass-transactions-to-all-queries
   */
  namespace?: any;

  /**
   * Attributes to exclude from versioning
   * @default []
   * @example ['password', 'refreshToken']
   */
  exclude?: string[];

  /**
   * Use underscores in the version table name
   * @default true
   * @example true: 'version_users', false: 'versionusers'
   */
  tableUnderscored?: boolean;

  /**
   * Use underscores in version attribute names
   * @default true
   * @example true: 'version_id', false: 'versionId'
   */
  underscored?: boolean;

  /**
   * Custom attributes to add to each version record
   * Useful for tracking who made changes, IP addresses, etc.
   */
  customAttributes?: CustomAttributeDefinitions;

  /**
   * Function to resolve custom attribute values at version creation time
   * Receives the hook context and should return attribute values
   */
  customAttributeResolver?: CustomAttributeResolver;

  /**
   * Enable tracking of which fields changed between versions
   * Adds a 'changedFields' attribute to version records
   * @default false
   */
  trackChangedFields?: boolean;
}

/**
 * Definition of custom attributes to add to version records
 * Uses Sequelize attribute definition format
 */
export interface CustomAttributeDefinitions {
  [key: string]: any;
}

/**
 * Context provided to custom attribute resolver
 */
export interface VersionContext {
  /** The hook that triggered the version */
  hook: Hook;
  /** The version type (created, updated, deleted) */
  versionType: VersionType;
  /** The instance data being versioned */
  instance: any;
  /** The transaction, if any */
  transaction?: Transaction;
  /** Previous values (for updates) */
  previousValues?: Record<string, any>;
  /** Changed fields (if trackChangedFields is enabled) */
  changedFields?: string[];
}

/**
 * Function type for resolving custom attribute values
 */
export type CustomAttributeResolver = (
  context: VersionContext
) => Record<string, any> | Promise<Record<string, any>>;

/**
 * Options for querying versions
 */
export interface GetVersionsOptions {
  /** Where clause for filtering versions */
  where?: WhereOptions;
  /** Maximum number of versions to return */
  limit?: number;
  /** Number of versions to skip */
  offset?: number;
  /** Order of results */
  order?: any;
  /** Include related models */
  include?: any;
  /** Transaction to use */
  transaction?: Transaction;
}

/**
 * Result of comparing two versions
 */
export interface VersionDiff {
  /** Fields that were added */
  added: Record<string, any>;
  /** Fields that were removed */
  removed: Record<string, any>;
  /** Fields that were modified with old and new values */
  modified: Record<string, { oldValue: any; newValue: any }>;
  /** Fields that remained unchanged */
  unchanged: string[];
}

/**
 * Extended model interface with version methods
 */
export interface VersionedModel<T extends Model = Model> {
  /** Get all versions of this instance */
  getVersions(options?: GetVersionsOptions): Promise<T[]>;
}

/**
 * Extended model static interface with version methods
 */
export interface VersionedModelStatic<T extends Model = Model> extends ModelStatic<T> {
  /** Get versions matching the query */
  getVersions(options?: GetVersionsOptions): Promise<T[]>;
}

/**
 * Version model with additional utility methods
 */
export interface VersionModelStatic<T extends Model = Model> extends ModelStatic<T> {
  /**
   * Compare two version records and return differences
   */
  diff(version1: T, version2: T): VersionDiff;

  /**
   * Get the version type enum
   */
  VersionType: typeof VersionType;
}

/**
 * Internal configuration after merging defaults
 */
export interface ResolvedVersionOptions extends Required<Omit<VersionOptions, 'sequelize' | 'namespace' | 'customAttributeResolver'>> {
  sequelize?: Sequelize;
  namespace?: any;
  customAttributeResolver?: CustomAttributeResolver;
}

/**
 * Compatibility layer for different Sequelize versions
 */
export interface SequelizeCompat {
  /** Get raw attributes from a model (handles v3-v7 differences) */
  getRawAttributes(model: ModelStatic<any>): Record<string, any>;
  /** Check if CLS is available and configured */
  getCLS(sequelize: Sequelize, namespace?: any): any;
  /** Get model name */
  getModelName(model: ModelStatic<any>): string;
  /** Get table name */
  getTableName(model: ModelStatic<any>): string;
}
