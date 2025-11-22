/**
 * Model Methods
 * Adds instance and static methods to source and version models
 * Follows Single Responsibility Principle
 */

import type { ModelStatic } from 'sequelize';
import type { GetVersionsOptions, ResolvedVersionOptions, VersionDiff } from '../types';
import { Hook } from '../types';
import { toArray, generateVersionFieldNames } from '../utils/helpers';
import { sequelizeCompat } from '../utils/sequelize-compat';
import { diffVersions, summarizeDiff, isIdentical, getModifiedFields, createPatch } from './diff-tool';

/**
 * Adds version-related methods to the source model and its instances
 */
export function addSourceModelMethods(
  sourceModel: ModelStatic<any>,
  versionModel: ModelStatic<any>,
  options: ResolvedVersionOptions
): void {
  const fieldNames = generateVersionFieldNames(
    options.attributePrefix,
    options.underscored
  );

  /**
   * Instance method: getVersions
   * Retrieves all versions for a specific instance
   */
  const getVersionsInstance = function (
    this: any,
    queryOptions?: GetVersionsOptions
  ): Promise<any[]> {
    // Get primary key values from the instance
    const attributes = sequelizeCompat.getRawAttributes(sourceModel);
    const primaryKeys = Object.keys(attributes).filter(
      attr => attributes[attr]?.primaryKey
    );

    // Build where clause from primary keys
    let whereClause: Record<string, any> = {};
    if (primaryKeys.length) {
      whereClause = primaryKeys
        .map(attr => ({ [attr]: this[attr] }))
        .reduce((a, b) => ({ ...a, ...b }), {});
    }

    // Merge with user-provided options
    const finalOptions: any = {
      ...queryOptions,
      where: {
        ...queryOptions?.where,
        ...whereClause,
      },
    };

    return versionModel.findAll(finalOptions);
  };

  // Add to prototype for v4+
  if (sourceModel.prototype) {
    if (!Object.prototype.hasOwnProperty.call(sourceModel.prototype, 'getVersions')) {
      sourceModel.prototype.getVersions = getVersionsInstance;
    }
  } else {
    // v3 compatibility: bind method to instances via hooks
    const hooksForBind = [
      Hook.AFTER_CREATE,
      Hook.AFTER_UPDATE,
      Hook.AFTER_BULK_CREATE,
      Hook.AFTER_DESTROY,
      Hook.AFTER_SAVE,
    ];

    hooksForBind.forEach(hook => {
      sourceModel.addHook(hook, (instance: any) => {
        const instances = toArray(instance);
        instances.forEach(i => {
          if (!i.getVersions) {
            i.getVersions = getVersionsInstance.bind(i);
          }
        });
      });
    });
  }

  /**
   * Static method: getVersions
   * Retrieves versions matching the query
   */
  if (!sourceModel.getVersions) {
    (sourceModel as any).getVersions = (
      queryOptions?: GetVersionsOptions
    ): Promise<any[]> => {
      return versionModel.findAll(queryOptions as any);
    };
  }
}

/**
 * Adds utility methods to the version model
 */
export function addVersionModelMethods(
  versionModel: ModelStatic<any>,
  options: ResolvedVersionOptions
): void {
  /**
   * Static method: diff
   * Compares two version records
   */
  (versionModel as any).diff = (
    version1: any,
    version2: any,
    diffOptions?: { exclude?: string[] }
  ): VersionDiff => {
    return diffVersions(version1, version2, {
      versionPrefix: options.attributePrefix,
      exclude: diffOptions?.exclude,
    });
  };

  /**
   * Static method: summarizeDiff
   * Creates human-readable diff summary
   */
  (versionModel as any).summarizeDiff = (diff: VersionDiff): string[] => {
    return summarizeDiff(diff);
  };

  /**
   * Static method: isIdentical
   * Checks if two versions are the same
   */
  (versionModel as any).isIdentical = (diff: VersionDiff): boolean => {
    return isIdentical(diff);
  };

  /**
   * Static method: getModifiedFields
   * Gets list of modified field names
   */
  (versionModel as any).getModifiedFields = (diff: VersionDiff): string[] => {
    return getModifiedFields(diff);
  };

  /**
   * Static method: createPatch
   * Creates a patch object from diff
   */
  (versionModel as any).createPatch = (diff: VersionDiff): Record<string, any> => {
    return createPatch(diff);
  };

  /**
   * Static method: getHistory
   * Gets version history for a record with diffs between consecutive versions
   */
  (versionModel as any).getHistory = async (
    where: any,
    queryOptions?: { order?: any; limit?: number }
  ): Promise<Array<{ version: any; diff?: VersionDiff }>> => {
    const fieldNames = generateVersionFieldNames(
      options.attributePrefix,
      options.underscored
    );

    const versions = await versionModel.findAll({
      where,
      order: queryOptions?.order || [[fieldNames.timestamp, 'ASC']],
      limit: queryOptions?.limit,
    });

    const history: Array<{ version: any; diff?: VersionDiff }> = [];

    for (let i = 0; i < versions.length; i++) {
      const version = versions[i];
      let diff: VersionDiff | undefined;

      if (i > 0) {
        diff = diffVersions(versions[i - 1]!, version!, {
          versionPrefix: options.attributePrefix,
        });
      }

      history.push({ version, diff });
    }

    return history;
  };
}
