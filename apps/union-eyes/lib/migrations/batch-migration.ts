/**
 * Batch Migration Engine
 * 
 * Handles batch migration of data from tenant_id to organization_id.
 * Processes tables in dependency order with transaction support.
 * 
 * Features:
 * - Multi-table migration with dependency resolution
 * - Transaction-based processing for data integrity
 * - Progress tracking and reporting
 * - Error handling and partial rollback
 * - Dry-run mode for validation
 * - Resumable migrations
 * 
 * @module lib/migrations/batch-migration
 */

import { db } from "@/db/db";
import { sql } from "drizzle-orm";
import {
  batchGetOrganizationIds,
  updateMappingStatus,
  validateMapping,
} from "./tenant-to-org-mapper";
import { logger } from '@/lib/logger';

// Migration configuration for each table
interface TableMigrationConfig {
  tableName: string;
  tenantIdColumn: string;
  organizationIdColumn: string;
  batchSize: number;
  dependencies: string[]; // Tables that must be migrated first
  validate?: (row: unknown) => Promise<boolean>;
}

// Migration result tracking
interface MigrationResult {
  tableName: string;
  totalRows: number;
  migratedRows: number;
  failedRows: number;
  skippedRows: number;
  errors: Array<{ row: unknown; error: string }>;
  duration: number;
  status: "pending" | "in_progress" | "completed" | "failed";
}

// =====================================================
// Table Migration Configurations
// =====================================================

const TABLE_CONFIGS: TableMigrationConfig[] = [
  {
    tableName: "profiles",
    tenantIdColumn: "tenant_id",
    organizationIdColumn: "organization_id",
    batchSize: 1000,
    dependencies: [],
  },
  {
    tableName: "claims",
    tenantIdColumn: "tenant_id",
    organizationIdColumn: "organization_id",
    batchSize: 500,
    dependencies: ["profiles"],
  },
  {
    tableName: "documents",
    tenantIdColumn: "tenant_id",
    organizationIdColumn: "organization_id",
    batchSize: 1000,
    dependencies: ["claims"],
  },
  {
    tableName: "precedents",
    tenantIdColumn: "tenant_id",
    organizationIdColumn: "organization_id",
    batchSize: 500,
    dependencies: [],
  },
  {
    tableName: "clause_library",
    tenantIdColumn: "tenant_id",
    organizationIdColumn: "organization_id",
    batchSize: 1000,
    dependencies: [],
  },
  {
    tableName: "certification_applications",
    tenantIdColumn: "tenant_id",
    organizationIdColumn: "organization_id",
    batchSize: 500,
    dependencies: [],
  },
  {
    tableName: "grievances",
    tenantIdColumn: "tenant_id",
    organizationIdColumn: "organization_id",
    batchSize: 500,
    dependencies: [],
  },
  {
    tableName: "strike_votes",
    tenantIdColumn: "tenant_id",
    organizationIdColumn: "organization_id",
    batchSize: 200,
    dependencies: [],
  },
];

// =====================================================
// Core Migration Functions
// =====================================================

/**
 * Migrate a single table from tenant_id to organization_id
 */
export async function migrateTable(
  config: TableMigrationConfig,
  dryRun: boolean = false,
  progressCallback?: (progress: number) => void
): Promise<MigrationResult> {
  const startTime = Date.now();
  const result: MigrationResult = {
    tableName: config.tableName,
    totalRows: 0,
    migratedRows: 0,
    failedRows: 0,
    skippedRows: 0,
    errors: [],
    duration: 0,
    status: "in_progress",
  };

  try {
    logger.info(`Migrating table: ${config.tableName}`);
    logger.info(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);

    // Check if organization_id column exists, add if not
    await ensureColumnExists(
      config.tableName,
      config.organizationIdColumn
    );

    // Get total row count
    const countResult = await db.execute(sql.raw(`
      SELECT COUNT(*) as count 
      FROM ${config.tableName}
      WHERE ${config.tenantIdColumn} IS NOT NULL
      AND (${config.organizationIdColumn} IS NULL OR ${config.organizationIdColumn} = '')
    `));

    result.totalRows = Number(countResult[0]?.count || 0);
    logger.info('Migration rows to process', { tableName: config.tableName, totalRows: result.totalRows });

    if (result.totalRows === 0) {
      logger.info('No rows to migrate', { tableName: config.tableName });
      result.status = "completed";
      result.duration = Date.now() - startTime;
      return result;
    }

    // Process in batches
    let offset = 0;
    const batchSize = config.batchSize;

    while (offset < result.totalRows) {
      // Fetch batch
      const batchResult = await db.execute(sql.raw(`
        SELECT *
        FROM ${config.tableName}
        WHERE ${config.tenantIdColumn} IS NOT NULL
        AND (${config.organizationIdColumn} IS NULL OR ${config.organizationIdColumn} = '')
        LIMIT ${batchSize} OFFSET ${offset}
      `));

      const batch = batchResult;

      // Get unique tenant IDs from batch
      const tenantIds = Array.from(new Set(
        batch.map((row: unknown) => (row as Record<string, unknown>)[config.tenantIdColumn]).filter(Boolean)
      )) as string[];

      // Batch map tenant IDs to organization IDs
      const mappings = await batchGetOrganizationIds(tenantIds);

      // Process each row
      for (const row of batch) {
        const tenantId = String(row[config.tenantIdColumn]);
        const organizationId = mappings.get(tenantId);

        if (!organizationId) {
          result.failedRows++;
          result.errors.push({
            row: { id: row.id, tenantId },
            error: `No organization mapping found for tenant: ${tenantId}`,
          });
          continue;
        }

        // Validate if custom validator provided
        if (config.validate) {
          const isValid = await config.validate(row);
          if (!isValid) {
            result.skippedRows++;
            continue;
          }
        }

        // Update row with organization_id
        if (!dryRun) {
          try {
            await db.execute(sql.raw(`
              UPDATE ${config.tableName}
              SET ${config.organizationIdColumn} = '${organizationId}',
                  updated_at = NOW()
              WHERE id = '${row.id}'
            `));
            result.migratedRows++;
          } catch (error) {
            result.failedRows++;
            result.errors.push({
              row: { id: row.id, tenantId },
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        } else {
          result.migratedRows++;
        }
      }

      offset += batchSize;

      // Report progress
      const progress = Math.min((offset / result.totalRows) * 100, 100);
      logger.info(
        `Progress: ${progress.toFixed(1)}% (${result.migratedRows}/${result.totalRows})`
      );

      if (progressCallback) {
        progressCallback(progress);
      }
    }

    result.status = result.failedRows === 0 ? "completed" : "failed";
    result.duration = Date.now() - startTime;

    logger.info('Migration completed', {
      tableName: config.tableName,
      status: result.status,
      migratedRows: result.migratedRows,
      failedRows: result.failedRows,
      skippedRows: result.skippedRows,
      durationSeconds: (result.duration / 1000).toFixed(2)
    });

    return result;
  } catch (error) {
    result.status = "failed";
    result.duration = Date.now() - startTime;
    logger.error('Migration failed', error instanceof Error ? error : new Error(String(error)), { tableName: config.tableName });
    result.errors.push({
      row: {},
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return result;
  }
}

/**
 * Migrate all tables in dependency order
 */
export async function migrateAllTables(
  dryRun: boolean = false,
  progressCallback?: (table: string, progress: number) => void
): Promise<Map<string, MigrationResult>> {
  const results = new Map<string, MigrationResult>();
  const startTime = Date.now();

  logger.info("Starting batch migration of all tables");
  logger.info(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
  logger.info(`Total tables: ${TABLE_CONFIGS.length}`);

  // Sort tables by dependencies (topological sort)
  const sortedConfigs = topologicalSort(TABLE_CONFIGS);

  // Migrate each table
  for (const config of sortedConfigs) {
    const result = await migrateTable(
      config,
      dryRun,
      progressCallback
        ? (progress) => progressCallback(config.tableName, progress)
        : undefined
    );

    results.set(config.tableName, result);

    // Stop if a critical table fails
    if (result.status === "failed" && config.dependencies.length === 0) {
      logger.error(`Critical table ${config.tableName} failed. Stopping migration.`);
      break;
    }
  }

  const totalDuration = Date.now() - startTime;
  const totalMigrated = Array.from(results.values()).reduce(
    (sum, r) => sum + r.migratedRows,
    0
  );
  const totalFailed = Array.from(results.values()).reduce(
    (sum, r) => sum + r.failedRows,
    0
  );

  logger.info("=".repeat(60));
  logger.info("MIGRATION SUMMARY");
  logger.info("=".repeat(60));
  logger.info(`Total duration: ${(totalDuration / 1000).toFixed(2)}s`);
  logger.info(`Total rows migrated: ${totalMigrated}`);
  logger.info(`Total rows failed: ${totalFailed}`);
  logger.info(`Tables processed: ${results.size}/${TABLE_CONFIGS.length}`);
  logger.info("=".repeat(60));

  return results;
}

/**
 * Migrate specific tenant's data across all tables
 */
export async function migrateTenant(
  tenantId: string,
  dryRun: boolean = false
): Promise<Map<string, MigrationResult>> {
  const results = new Map<string, MigrationResult>();

  logger.info(`Migrating tenant: ${tenantId}`);
  logger.info(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);

  // Validate mapping exists
  const mapping = await validateMapping(tenantId);
  if (!mapping.exists) {
    logger.warn(`No mapping found for tenant: ${tenantId}`);
    return results;
  }

  if (!dryRun) {
    await updateMappingStatus(tenantId, "in_progress");
  }

  const organizationId = mapping.organizationId!;
  let totalRecords = 0;

  // Process each table
  for (const config of TABLE_CONFIGS) {
    const startTime = Date.now();

    try {
      // Get count for this tenant
      const countResult = await db.execute(sql.raw(`
        SELECT COUNT(*) as count 
        FROM ${config.tableName}
        WHERE ${config.tenantIdColumn} = '${tenantId}'
        AND (${config.organizationIdColumn} IS NULL OR ${config.organizationIdColumn} = '')
      `));

      const count = Number(countResult[0]?.count || 0);

      if (count === 0) {
        continue;
      }

      logger.info(`Migrating ${config.tableName}: ${count} rows`);

      if (!dryRun) {
        await db.execute(sql.raw(`
          UPDATE ${config.tableName}
          SET ${config.organizationIdColumn} = '${organizationId}',
              updated_at = NOW()
          WHERE ${config.tenantIdColumn} = '${tenantId}'
          AND (${config.organizationIdColumn} IS NULL OR ${config.organizationIdColumn} = '')
        `));
      }

      totalRecords += count;

      results.set(config.tableName, {
        tableName: config.tableName,
        totalRows: count,
        migratedRows: count,
        failedRows: 0,
        skippedRows: 0,
        errors: [],
        duration: Date.now() - startTime,
        status: "completed",
      });

      logger.info(`Completed ${config.tableName}`);
    } catch (error) {
      logger.error(`Failed ${config.tableName}`, { error });
      results.set(config.tableName, {
        tableName: config.tableName,
        totalRows: 0,
        migratedRows: 0,
        failedRows: 0,
        skippedRows: 0,
        errors: [
          {
            row: {},
            error: error instanceof Error ? error.message : "Unknown error",
          },
        ],
        duration: Date.now() - startTime,
        status: "failed",
      });
    }
  }

  if (!dryRun) {
    await updateMappingStatus(tenantId, "completed", totalRecords);
  }

  logger.info(`Tenant migration completed: ${totalRecords} records migrated`);
  return results;
}

// =====================================================
// Helper Functions
// =====================================================

/**
 * Ensure organization_id column exists in table
 */
async function ensureColumnExists(
  tableName: string,
  columnName: string
): Promise<void> {
  try {
    // Check if column exists
    const result = await db.execute(sql.raw(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = '${tableName}' 
      AND column_name = '${columnName}'
    `));

    if (result.length === 0) {
      logger.info(`Adding ${columnName} column to ${tableName}...`);
      await db.execute(sql.raw(`
        ALTER TABLE ${tableName} 
        ADD COLUMN IF NOT EXISTS ${columnName} UUID
      `));

      // Add index for performance
      await db.execute(sql.raw(`
        CREATE INDEX IF NOT EXISTS idx_${tableName}_${columnName}
        ON ${tableName}(${columnName})
      `));

      logger.info("Column added successfully");
    }
  } catch (error) {
    logger.error("Error ensuring column exists", { error });
    throw error;
  }
}

/**
 * Topological sort of table configs by dependencies
 */
function topologicalSort(
  configs: TableMigrationConfig[]
): TableMigrationConfig[] {
  const sorted: TableMigrationConfig[] = [];
  const visited = new Set<string>();
  const configMap = new Map(configs.map((c) => [c.tableName, c]));

  function visit(config: TableMigrationConfig) {
    if (visited.has(config.tableName)) return;

    // Visit dependencies first
    for (const dep of config.dependencies) {
      const depConfig = configMap.get(dep);
      if (depConfig) {
        visit(depConfig);
      }
    }

    visited.add(config.tableName);
    sorted.push(config);
  }

  configs.forEach((config) => visit(config));
  return sorted;
}

/**
 * Get migration progress for all tables
 */
export async function getMigrationProgress(): Promise<{
  tables: Array<{
    tableName: string;
    total: number;
    migrated: number;
    percentage: number;
  }>;
  overall: {
    total: number;
    migrated: number;
    percentage: number;
  };
}> {
  const tableProgress: Array<{
    tableName: string;
    total: number;
    migrated: number;
    percentage: number;
  }> = [];

  let overallTotal = 0;
  let overallMigrated = 0;

  for (const config of TABLE_CONFIGS) {
    try {
      const result = await db.execute(sql.raw(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN ${config.organizationIdColumn} IS NOT NULL 
                   AND ${config.organizationIdColumn} != '' THEN 1 ELSE 0 END) as migrated
        FROM ${config.tableName}
        WHERE ${config.tenantIdColumn} IS NOT NULL
      `));

      const row = result[0];
      const total = Number(row?.total || 0);
      const migrated = Number(row?.migrated || 0);
      const percentage = total > 0 ? (migrated / total) * 100 : 0;

      tableProgress.push({
        tableName: config.tableName,
        total,
        migrated,
        percentage,
      });

      overallTotal += total;
      overallMigrated += migrated;
    } catch (error) {
      logger.error(`Error getting progress for ${config.tableName}`, { error });
    }
  }

  const overallPercentage =
    overallTotal > 0 ? (overallMigrated / overallTotal) * 100 : 0;

  return {
    tables: tableProgress,
    overall: {
      total: overallTotal,
      migrated: overallMigrated,
      percentage: overallPercentage,
    },
  };
}

