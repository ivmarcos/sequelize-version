/**
 * Diff Tool
 * Provides utilities for comparing version records
 * Follows Single Responsibility Principle
 */

import type { Model } from 'sequelize';
import type { VersionDiff } from '../types';
import { computeObjectDiff } from '../utils/helpers';

/**
 * Default attributes to exclude from diff comparison
 * These are version-specific metadata fields
 */
const DEFAULT_EXCLUDE_PATTERNS = [
  /_id$/,
  /Id$/,
  /_type$/,
  /Type$/,
  /_timestamp$/,
  /Timestamp$/,
  /_changed_fields$/,
  /ChangedFields$/,
];

/**
 * Checks if an attribute name matches any exclude pattern
 */
function matchesExcludePattern(name: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(name));
}

/**
 * Extracts comparable data from a version instance
 * Removes version-specific metadata fields
 */
function extractComparableData(
  instance: Model | Record<string, any>,
  versionPrefix: string,
  customExclude: string[] = []
): Record<string, any> {
  // Get raw data values
  const data = 'dataValues' in instance
    ? { ...(instance as Model).dataValues }
    : { ...instance };

  // Build list of keys to exclude
  const keysToExclude: string[] = [...customExclude];

  // Add version-specific fields based on prefix
  keysToExclude.push(
    `${versionPrefix}_id`,
    `${versionPrefix}_type`,
    `${versionPrefix}_timestamp`,
    `${versionPrefix}_changed_fields`,
    `${versionPrefix}Id`,
    `${versionPrefix}Type`,
    `${versionPrefix}Timestamp`,
    `${versionPrefix}ChangedFields`
  );

  // Remove excluded keys
  for (const key of keysToExclude) {
    delete data[key];
  }

  // Remove any remaining keys that match exclude patterns
  for (const key of Object.keys(data)) {
    if (matchesExcludePattern(key, DEFAULT_EXCLUDE_PATTERNS)) {
      delete data[key];
    }
  }

  return data;
}

/**
 * Options for the diff operation
 */
export interface DiffOptions {
  /**
   * Version attribute prefix used in the version model
   * @default 'version'
   */
  versionPrefix?: string;

  /**
   * Additional attribute names to exclude from comparison
   */
  exclude?: string[];

  /**
   * Whether to include values that are equal in both versions
   * If false, only differences are returned
   * @default true
   */
  includeUnchanged?: boolean;
}

/**
 * Compares two version records and returns their differences
 *
 * @param version1 - First version (typically older)
 * @param version2 - Second version (typically newer)
 * @param options - Diff configuration options
 * @returns Object containing added, removed, modified, and unchanged fields
 *
 * @example
 * ```typescript
 * const diff = diffVersions(oldVersion, newVersion);
 * console.log(diff.modified);
 * // { name: { oldValue: 'Jack', newValue: 'Jack Johnson' } }
 * ```
 */
export function diffVersions(
  version1: Model | Record<string, any>,
  version2: Model | Record<string, any>,
  options: DiffOptions = {}
): VersionDiff {
  const {
    versionPrefix = 'version',
    exclude = [],
    includeUnchanged = true,
  } = options;

  // Extract comparable data from both versions
  const data1 = extractComparableData(version1, versionPrefix, exclude);
  const data2 = extractComparableData(version2, versionPrefix, exclude);

  // Compute the diff
  const diff = computeObjectDiff(data1, data2);

  // Optionally exclude unchanged fields
  if (!includeUnchanged) {
    return {
      ...diff,
      unchanged: [],
    };
  }

  return diff;
}

/**
 * Creates a human-readable summary of version differences
 *
 * @param diff - The diff result from diffVersions
 * @returns Array of human-readable change descriptions
 *
 * @example
 * ```typescript
 * const summary = summarizeDiff(diff);
 * // ['Added field "email"', 'Modified "name": "Jack" → "Jack Johnson"']
 * ```
 */
export function summarizeDiff(diff: VersionDiff): string[] {
  const summary: string[] = [];

  // Added fields
  for (const [key, value] of Object.entries(diff.added)) {
    summary.push(`Added "${key}": ${JSON.stringify(value)}`);
  }

  // Removed fields
  for (const [key, value] of Object.entries(diff.removed)) {
    summary.push(`Removed "${key}": ${JSON.stringify(value)}`);
  }

  // Modified fields
  for (const [key, { oldValue, newValue }] of Object.entries(diff.modified)) {
    summary.push(
      `Modified "${key}": ${JSON.stringify(oldValue)} → ${JSON.stringify(newValue)}`
    );
  }

  return summary;
}

/**
 * Checks if two versions are identical (no changes)
 *
 * @param diff - The diff result from diffVersions
 * @returns True if there are no differences
 */
export function isIdentical(diff: VersionDiff): boolean {
  return (
    Object.keys(diff.added).length === 0 &&
    Object.keys(diff.removed).length === 0 &&
    Object.keys(diff.modified).length === 0
  );
}

/**
 * Gets only the modified field names from a diff
 *
 * @param diff - The diff result from diffVersions
 * @returns Array of field names that were modified
 */
export function getModifiedFields(diff: VersionDiff): string[] {
  return Object.keys(diff.modified);
}

/**
 * Creates a patch object that can be applied to transform version1 to version2
 *
 * @param diff - The diff result from diffVersions
 * @returns Object with values to apply
 */
export function createPatch(diff: VersionDiff): Record<string, any> {
  const patch: Record<string, any> = {};

  // Add new fields
  for (const [key, value] of Object.entries(diff.added)) {
    patch[key] = value;
  }

  // Add modified fields (new values)
  for (const [key, { newValue }] of Object.entries(diff.modified)) {
    patch[key] = newValue;
  }

  return patch;
}
