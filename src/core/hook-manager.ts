/**
 * Hook Manager
 * Manages Sequelize lifecycle hooks for version tracking
 * Follows Single Responsibility Principle
 */

import type { ModelStatic, Sequelize, Transaction } from 'sequelize';
import { Hook, VersionType, type ResolvedVersionOptions, type VersionContext } from '../types';
import { toArray, clone, getChangedFields, generateVersionFieldNames } from '../utils/helpers';
import { getTransactionFromCLS } from '../utils/sequelize-compat';

/**
 * Maps hooks to their corresponding version types
 */
function getVersionType(hook: Hook): VersionType {
  switch (hook) {
    case Hook.AFTER_CREATE:
    case Hook.AFTER_BULK_CREATE:
      return VersionType.CREATED;
    case Hook.AFTER_UPDATE:
      return VersionType.UPDATED;
    case Hook.AFTER_DESTROY:
      return VersionType.DELETED;
    default:
      throw new Error(`Unknown hook: ${hook}`);
  }
}

/**
 * Hooks that trigger version creation
 */
const VERSION_HOOKS = [
  Hook.AFTER_CREATE,
  Hook.AFTER_UPDATE,
  Hook.AFTER_BULK_CREATE,
  Hook.AFTER_DESTROY,
];

/**
 * Manager class for handling Sequelize hooks
 */
export class HookManager {
  private readonly sourceModel: ModelStatic<any>;
  private readonly versionModel: ModelStatic<any>;
  private readonly options: ResolvedVersionOptions;
  private readonly sequelize: Sequelize;
  private readonly fieldNames: { id: string; type: string; timestamp: string };

  constructor(
    sourceModel: ModelStatic<any>,
    versionModel: ModelStatic<any>,
    options: ResolvedVersionOptions,
    sequelize: Sequelize
  ) {
    this.sourceModel = sourceModel;
    this.versionModel = versionModel;
    this.options = options;
    this.sequelize = sequelize;
    this.fieldNames = generateVersionFieldNames(
      options.attributePrefix,
      options.underscored
    );
  }

  /**
   * Registers all version tracking hooks on the source model
   */
  registerHooks(): void {
    for (const hook of VERSION_HOOKS) {
      this.sourceModel.addHook(hook, this.createHookHandler(hook));
    }
  }

  /**
   * Creates a hook handler for the specified hook type
   */
  private createHookHandler(hook: Hook) {
    return async (
      instanceData: any,
      hookOptions: { transaction?: Transaction } = {}
    ): Promise<void> => {
      const versionType = getVersionType(hook);
      const instances = toArray(instanceData);

      // Resolve transaction from CLS or explicit option
      const transaction = this.resolveTransaction(hookOptions.transaction);

      // Create version records for each instance
      const versionRecords = await Promise.all(
        instances.map(instance => this.createVersionRecord(instance, versionType, hook, transaction))
      );

      // Bulk create all version records
      await this.versionModel.bulkCreate(versionRecords, { transaction });
    };
  }

  /**
   * Resolves the transaction to use for version creation
   */
  private resolveTransaction(explicitTransaction?: Transaction): Transaction | undefined {
    // If using the same sequelize instance, try to get transaction from CLS
    if (this.options.sequelize === undefined || this.options.sequelize === this.sourceModel.sequelize) {
      return getTransactionFromCLS(
        this.sequelize,
        this.options.namespace,
        explicitTransaction
      );
    }

    // Using external sequelize, only use CLS if configured
    return getTransactionFromCLS(
      this.sequelize,
      this.options.namespace,
      undefined
    );
  }

  /**
   * Creates a version record from an instance
   */
  private async createVersionRecord(
    instance: any,
    versionType: VersionType,
    hook: Hook,
    transaction?: Transaction
  ): Promise<Record<string, any>> {
    // Clone the instance data
    const data = clone(instance.dataValues || instance);

    // Add version metadata
    const versionData: Record<string, any> = {
      ...data,
      [this.fieldNames.type]: versionType,
      [this.fieldNames.timestamp]: new Date(),
    };

    // Track changed fields if enabled
    let changedFields: string[] | undefined;
    if (this.options.trackChangedFields && versionType === VersionType.UPDATED) {
      changedFields = getChangedFields(instance);
      const changedFieldsAttrName = this.options.underscored
        ? `${this.options.attributePrefix}_changed_fields`
        : `${this.options.attributePrefix}ChangedFields`;
      versionData[changedFieldsAttrName] = changedFields;
    }

    // Resolve custom attributes if configured
    if (this.options.customAttributeResolver) {
      const context: VersionContext = {
        hook,
        versionType,
        instance,
        transaction,
        previousValues: instance._previousDataValues,
        changedFields,
      };

      const customValues = await this.options.customAttributeResolver(context);
      Object.assign(versionData, customValues);
    }

    return versionData;
  }
}

/**
 * Factory function for creating and registering hooks
 */
export function registerVersionHooks(
  sourceModel: ModelStatic<any>,
  versionModel: ModelStatic<any>,
  options: ResolvedVersionOptions,
  sequelize: Sequelize
): void {
  const manager = new HookManager(sourceModel, versionModel, options, sequelize);
  manager.registerHooks();
}
