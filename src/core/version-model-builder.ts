/**
 * Version Model Builder
 * Responsible for creating the version model with proper attributes
 * Follows Single Responsibility Principle
 */

import { DataTypes } from 'sequelize';
import type { ModelStatic, Sequelize, ModelAttributes, ModelOptions } from 'sequelize';
import type { ResolvedVersionOptions, CustomAttributeDefinitions } from '../types';
import {
  cloneModelAttributes,
  generateTableName,
  generateModelName,
  generateVersionFieldNames
} from '../utils/helpers';
import { sequelizeCompat } from '../utils/sequelize-compat';

/**
 * Attributes that are cloned from the source model
 * These define the structure of the versioned data
 */
const ATTRS_TO_CLONE = ['type', 'field', 'get', 'set'];

/**
 * Builder class for creating version models
 * Encapsulates the complexity of version model creation
 */
export class VersionModelBuilder {
  private readonly sourceModel: ModelStatic<any>;
  private readonly options: ResolvedVersionOptions;
  private readonly sequelize: Sequelize;

  constructor(
    sourceModel: ModelStatic<any>,
    options: ResolvedVersionOptions,
    sequelize: Sequelize
  ) {
    this.sourceModel = sourceModel;
    this.options = options;
    this.sequelize = sequelize;
  }

  /**
   * Builds and returns the version model
   */
  build(): ModelStatic<any> {
    const modelName = this.generateModelName();
    const tableName = this.generateTableName();
    const attributes = this.buildAttributes();
    const modelOptions = this.buildModelOptions(tableName);

    const versionModel = this.sequelize.define(modelName, attributes, modelOptions);

    // Add scopes for filtering by version type
    this.addScopes(versionModel);

    return versionModel;
  }

  /**
   * Generates the version model name
   */
  private generateModelName(): string {
    const sourceName = sequelizeCompat.getModelName(this.sourceModel);
    return generateModelName(sourceName, this.options.prefix, this.options.suffix);
  }

  /**
   * Generates the version table name
   */
  private generateTableName(): string {
    const sourceTableName = sequelizeCompat.getTableName(this.sourceModel);
    return generateTableName(
      sourceTableName,
      this.options.prefix,
      this.options.suffix,
      this.options.tableUnderscored
    );
  }

  /**
   * Builds the complete attribute set for the version model
   */
  private buildAttributes(): ModelAttributes<any> {
    // Clone source model attributes
    const sourceAttrs = sequelizeCompat.getRawAttributes(this.sourceModel);
    const clonedAttrs = cloneModelAttributes(sourceAttrs, ATTRS_TO_CLONE, this.options.exclude);

    // Get version-specific field names
    const fieldNames = generateVersionFieldNames(
      this.options.attributePrefix,
      this.options.underscored
    );

    // Version-specific attributes
    const versionAttrs: ModelAttributes<any> = {
      [fieldNames.id]: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        comment: 'Unique identifier for this version record',
      },
      [fieldNames.type]: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Type of operation: 1=created, 2=updated, 3=deleted',
      },
      [fieldNames.timestamp]: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Timestamp when this version was created',
      },
    };

    // Add changed fields tracking if enabled
    if (this.options.trackChangedFields) {
      const changedFieldsAttrName = this.options.underscored
        ? `${this.options.attributePrefix}_changed_fields`
        : `${this.options.attributePrefix}ChangedFields`;

      versionAttrs[changedFieldsAttrName] = {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Array of field names that changed in this version',
      };
    }

    // Add custom attributes if provided
    if (this.options.customAttributes) {
      this.addCustomAttributes(versionAttrs, this.options.customAttributes);
    }

    // Merge all attributes (version attrs take precedence)
    return { ...clonedAttrs, ...versionAttrs };
  }

  /**
   * Adds custom attributes to the version model
   */
  private addCustomAttributes(
    attrs: ModelAttributes<any>,
    customAttrs: CustomAttributeDefinitions
  ): void {
    for (const [name, definition] of Object.entries(customAttrs)) {
      // Support both simple type definitions and full attribute objects
      if (typeof definition === 'function' || definition?.type) {
        attrs[name] = definition;
      } else {
        attrs[name] = { type: definition };
      }
    }
  }

  /**
   * Builds model options for the version model
   */
  private buildModelOptions(tableName: string): ModelOptions {
    return {
      schema: this.options.schema || (this.sourceModel.options as any).schema,
      tableName,
      timestamps: false,
      // Prevent Sequelize from pluralizing the table name
      freezeTableName: true,
    };
  }

  /**
   * Adds default scopes for filtering versions by type
   */
  private addScopes(model: ModelStatic<any>): void {
    const fieldNames = generateVersionFieldNames(
      this.options.attributePrefix,
      this.options.underscored
    );

    // Scope for created records
    model.addScope('created', {
      where: { [fieldNames.type]: 1 }, // VersionType.CREATED
    });

    // Scope for updated records
    model.addScope('updated', {
      where: { [fieldNames.type]: 2 }, // VersionType.UPDATED
    });

    // Scope for deleted records
    model.addScope('deleted', {
      where: { [fieldNames.type]: 3 }, // VersionType.DELETED
    });
  }
}

/**
 * Factory function for creating version models
 * Provides a cleaner API than direct class instantiation
 */
export function buildVersionModel(
  sourceModel: ModelStatic<any>,
  options: ResolvedVersionOptions,
  sequelize: Sequelize
): ModelStatic<any> {
  const builder = new VersionModelBuilder(sourceModel, options, sequelize);
  return builder.build();
}
