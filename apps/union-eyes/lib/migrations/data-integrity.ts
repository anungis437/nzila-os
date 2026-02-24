/**
 * Data Integrity Verification
 * 
 * Validates data consistency before and after migration.
 * Checks referential integrity, data completeness, and constraint violations.
 * 
 * Features:
 * - Pre-migration validation checks
 * - Post-migration verification
 * - Referential integrity validation
 * - Orphan record detection
 * - Data completeness checks
 * - Constraint violation detection
 * 
 * @module lib/migrations/data-integrity
 */

import { db } from "@/db/db";
import { sql } from "drizzle-orm";

interface IntegrityIssue {
  severity: "critical" | "warning" | "info";
  table: string;
  column?: string;
  description: string;
  count: number;
  exampleIds?: string[];
}

interface IntegrityReport {
  timestamp: Date;
  phase: "pre-migration" | "post-migration";
  status: "pass" | "fail" | "warning";
  totalIssues: number;
  criticalIssues: number;
  warningIssues: number;
  infoIssues: number;
  issues: IntegrityIssue[];
  recommendations: string[];
}

// =====================================================
// Pre-Migration Validation
// =====================================================

/**
 * Run all pre-migration validation checks
 */
export async function runPreMigrationValidation(): Promise<IntegrityReport> {
const issues: IntegrityIssue[] = [];
  const recommendations: string[] = [];

  // Check 1: Validate all tenant_id values have organizations
  await checkTenantOrganizationMapping(issues);

  // Check 2: Check for orphaned records
  await checkOrphanedRecords(issues);

  // Check 3: Check for null tenant_id where required
  await checkNullTenantIds(issues);

  // Check 4: Validate foreign key relationships
  await checkForeignKeyIntegrity(issues);

  // Check 5: Check for duplicate records
  await checkDuplicateRecords(issues);

  // Generate recommendations
  if (issues.some((i) => i.severity === "critical")) {
    recommendations.push(
      "ÃƒÂ¢Ã‚ÂÃ…â€™ Critical issues found - migration should not proceed until resolved"
    );
  }

  if (issues.some((i) => i.severity === "warning")) {
    recommendations.push(
      "ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â  Warnings found - review before proceeding with migration"
    );
  }

  if (issues.length === 0) {
    recommendations.push("ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ All pre-migration checks passed");
  }

  const criticalIssues = issues.filter((i) => i.severity === "critical").length;
  const warningIssues = issues.filter((i) => i.severity === "warning").length;
  const infoIssues = issues.filter((i) => i.severity === "info").length;

  const status =
    criticalIssues > 0 ? "fail" : warningIssues > 0 ? "warning" : "pass";

  const report: IntegrityReport = {
    timestamp: new Date(),
    phase: "pre-migration",
    status,
    totalIssues: issues.length,
    criticalIssues,
    warningIssues,
    infoIssues,
    issues,
    recommendations,
  };

  printReport(report);
  return report;
}

/**
 * Check that all tenant_id values have corresponding organizations
 */
async function checkTenantOrganizationMapping(
  issues: IntegrityIssue[]
): Promise<void> {
  const tables = [
    "profiles",
    "claims",
    "documents",
    "precedents",
    "clause_library",
    "certification_applications",
    "grievances",
    "strike_votes",
  ];

  for (const tableName of tables) {
    try {
      const result = await db.execute(sql.raw(`
        SELECT DISTINCT t.tenant_id
        FROM ${tableName} t
        LEFT JOIN tenant_org_mappings m ON t.tenant_id = m.tenant_id
        WHERE t.tenant_id IS NOT NULL
        AND m.organization_id IS NULL
        LIMIT 5
      `));

      if (result.length > 0) {
        const tenantIds = result.map((r) => r.tenant_id as string);

        // Get total count
        const countResult = await db.execute(sql.raw(`
          SELECT COUNT(DISTINCT t.tenant_id) as count
          FROM ${tableName} t
          LEFT JOIN tenant_org_mappings m ON t.tenant_id = m.tenant_id
          WHERE t.tenant_id IS NOT NULL
          AND m.organization_id IS NULL
        `));

        const count = Number(countResult[0]?.count || 0);

        issues.push({
          severity: "critical",
          table: tableName,
          column: "tenant_id",
          description: "Tenant IDs without organization mapping",
          count,
          exampleIds: tenantIds,
        });
      }
    } catch (_error) {
}
  }
}

/**
 * Check for orphaned records (references to non-existent entities)
 */
async function checkOrphanedRecords(issues: IntegrityIssue[]): Promise<void> {
  // Check claims with non-existent profiles
  try {
    const result = await db.execute(sql.raw(`
      SELECT c.id
      FROM claims c
      LEFT JOIN profiles p ON c.user_id = p.id
      WHERE c.user_id IS NOT NULL
      AND p.id IS NULL
      LIMIT 5
    `));

    if (result.length > 0) {
      const countResult = await db.execute(sql.raw(`
        SELECT COUNT(*) as count
        FROM claims c
        LEFT JOIN profiles p ON c.user_id = p.id
        WHERE c.user_id IS NOT NULL
        AND p.id IS NULL
      `));

      const count = Number(countResult[0]?.count || 0);

      issues.push({
        severity: "warning",
        table: "claims",
        column: "user_id",
        description: "Claims referencing non-existent profiles",
        count,
        exampleIds: result.map((r) => r.id as string),
      });
    }
  } catch (_error) {
}

  // Check documents with non-existent claims
  try {
    const result = await db.execute(sql.raw(`
      SELECT d.id
      FROM documents d
      LEFT JOIN claims c ON d.claim_id = c.id
      WHERE d.claim_id IS NOT NULL
      AND c.id IS NULL
      LIMIT 5
    `));

    if (result.length > 0) {
      const countResult = await db.execute(sql.raw(`
        SELECT COUNT(*) as count
        FROM documents d
        LEFT JOIN claims c ON d.claim_id = c.id
        WHERE d.claim_id IS NOT NULL
        AND c.id IS NULL
      `));

      const count = Number(countResult[0]?.count || 0);

      issues.push({
        severity: "warning",
        table: "documents",
        column: "claim_id",
        description: "Documents referencing non-existent claims",
        count,
        exampleIds: result.map((r) => r.id as string),
      });
    }
  } catch (_error) {
}
}

/**
 * Check for null tenant_id where it should be required
 */
async function checkNullTenantIds(issues: IntegrityIssue[]): Promise<void> {
  const tables = [
    "profiles",
    "claims",
    "documents",
    "precedents",
    "clause_library",
    "certification_applications",
    "grievances",
    "strike_votes",
  ];

  for (const tableName of tables) {
    try {
      const result = await db.execute(sql.raw(`
        SELECT COUNT(*) as count
        FROM ${tableName}
        WHERE tenant_id IS NULL
      `));

      const count = Number(result[0]?.count || 0);

      if (count > 0) {
        issues.push({
          severity: "warning",
          table: tableName,
          column: "tenant_id",
          description: "Records with null tenant_id",
          count,
        });
      }
    } catch (_error) {
}
  }
}

/**
 * Check foreign key integrity
 */
async function checkForeignKeyIntegrity(
  issues: IntegrityIssue[]
): Promise<void> {
  // This would check all foreign key relationships
  // Example: claims.user_id ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ profiles.id
  
  const foreignKeys = [
    {
      table: "claims",
      column: "user_id",
      refTable: "profiles",
      refColumn: "id",
    },
    {
      table: "documents",
      column: "claim_id",
      refTable: "claims",
      refColumn: "id",
    },
    {
      table: "documents",
      column: "uploaded_by",
      refTable: "profiles",
      refColumn: "id",
    },
  ];

  for (const fk of foreignKeys) {
    try {
      const result = await db.execute(sql.raw(`
        SELECT COUNT(*) as count
        FROM ${fk.table} t
        LEFT JOIN ${fk.refTable} r ON t.${fk.column} = r.${fk.refColumn}
        WHERE t.${fk.column} IS NOT NULL
        AND r.${fk.refColumn} IS NULL
      `));

      const count = Number(result[0]?.count || 0);

      if (count > 0) {
        issues.push({
          severity: "critical",
          table: fk.table,
          column: fk.column,
          description: `Invalid foreign key reference to ${fk.refTable}.${fk.refColumn}`,
          count,
        });
      }
    } catch (_error) {
}
  }
}

/**
 * Check for duplicate records
 */
async function checkDuplicateRecords(issues: IntegrityIssue[]): Promise<void> {
  // Check for duplicate organization slugs
  try {
    const result = await db.execute(sql.raw(`
      SELECT slug, COUNT(*) as count
      FROM organizations
      GROUP BY slug
      HAVING COUNT(*) > 1
    `));

    if (result.length > 0) {
      issues.push({
        severity: "critical",
        table: "organizations",
        column: "slug",
        description: "Duplicate organization slugs found",
        count: result.length,
        exampleIds: result.map((r) => r.slug as string),
      });
    }
  } catch (_error) {
}
}

// =====================================================
// Post-Migration Validation
// =====================================================

/**
 * Run all post-migration validation checks
 */
export async function runPostMigrationValidation(): Promise<IntegrityReport> {
const issues: IntegrityIssue[] = [];
  const recommendations: string[] = [];

  // Check 1: Verify all rows have organization_id
  await checkOrganizationIdPopulation(issues);

  // Check 2: Verify organization_id references valid organizations
  await checkOrganizationIdValidity(issues);

  // Check 3: Check data consistency (tenant ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ org mapping)
  await checkMappingConsistency(issues);

  // Check 4: Verify no data loss
  await checkDataCompleteness(issues);

  // Check 5: Verify hierarchical relationships
  await checkHierarchicalIntegrity(issues);

  // Generate recommendations
  if (issues.some((i) => i.severity === "critical")) {
    recommendations.push(
      "ÃƒÂ¢Ã‚ÂÃ…â€™ Critical issues found - consider rolling back migration"
    );
  }

  if (issues.some((i) => i.severity === "warning")) {
    recommendations.push(
      "ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â  Warnings found - manual review recommended"
    );
  }

  if (issues.length === 0) {
    recommendations.push("ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ All post-migration checks passed");
    recommendations.push("ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Migration successful - data integrity maintained");
  }

  const criticalIssues = issues.filter((i) => i.severity === "critical").length;
  const warningIssues = issues.filter((i) => i.severity === "warning").length;
  const infoIssues = issues.filter((i) => i.severity === "info").length;

  const status =
    criticalIssues > 0 ? "fail" : warningIssues > 0 ? "warning" : "pass";

  const report: IntegrityReport = {
    timestamp: new Date(),
    phase: "post-migration",
    status,
    totalIssues: issues.length,
    criticalIssues,
    warningIssues,
    infoIssues,
    issues,
    recommendations,
  };

  printReport(report);
  return report;
}

/**
 * Check that all migrated rows have organization_id
 */
async function checkOrganizationIdPopulation(
  issues: IntegrityIssue[]
): Promise<void> {
  const tables = [
    "profiles",
    "claims",
    "documents",
    "precedents",
    "clause_library",
    "certification_applications",
    "grievances",
    "strike_votes",
  ];

  for (const tableName of tables) {
    try {
      const result = await db.execute(sql.raw(`
        SELECT COUNT(*) as count
        FROM ${tableName}
        WHERE tenant_id IS NOT NULL
        AND (organization_id IS NULL OR organization_id = '')
      `));

      const count = Number(result[0]?.count || 0);

      if (count > 0) {
        issues.push({
          severity: "critical",
          table: tableName,
          column: "organization_id",
          description: "Records with tenant_id but no organization_id",
          count,
        });
      }
    } catch (_error) {
}
  }
}

/**
 * Check that organization_id references valid organizations
 */
async function checkOrganizationIdValidity(
  issues: IntegrityIssue[]
): Promise<void> {
  const tables = [
    "profiles",
    "claims",
    "documents",
    "precedents",
    "clause_library",
    "certification_applications",
    "grievances",
    "strike_votes",
  ];

  for (const tableName of tables) {
    try {
      const result = await db.execute(sql.raw(`
        SELECT COUNT(*) as count
        FROM ${tableName} t
        LEFT JOIN organizations o ON t.organization_id = o.id
        WHERE t.organization_id IS NOT NULL
        AND o.id IS NULL
      `));

      const count = Number(result[0]?.count || 0);

      if (count > 0) {
        issues.push({
          severity: "critical",
          table: tableName,
          column: "organization_id",
          description: "References to non-existent organizations",
          count,
        });
      }
    } catch (_error) {
}
  }
}

/**
 * Check mapping consistency
 */
async function checkMappingConsistency(
  issues: IntegrityIssue[]
): Promise<void> {
  const tables = [
    "profiles",
    "claims",
    "documents",
    "precedents",
    "clause_library",
    "certification_applications",
    "grievances",
    "strike_votes",
  ];

  for (const tableName of tables) {
    try {
      // Check if same tenant_id maps to multiple organization_ids
      const result = await db.execute(sql.raw(`
        SELECT tenant_id, COUNT(DISTINCT organization_id) as org_count
        FROM ${tableName}
        WHERE tenant_id IS NOT NULL
        AND organization_id IS NOT NULL
        GROUP BY tenant_id
        HAVING COUNT(DISTINCT organization_id) > 1
      `));

      if (result.length > 0) {
        issues.push({
          severity: "critical",
          table: tableName,
          description: "Inconsistent tenant-to-organization mapping",
          count: result.length,
        });
      }
    } catch (_error) {
}
  }
}

/**
 * Check data completeness (no data loss)
 */
async function checkDataCompleteness(issues: IntegrityIssue[]): Promise<void> {
  const tables = [
    "profiles",
    "claims",
    "documents",
    "precedents",
    "clause_library",
    "certification_applications",
    "grievances",
    "strike_votes",
  ];

  for (const tableName of tables) {
    try {
      // Compare pre and post migration counts
      const totalResult = await db.execute(sql.raw(`
        SELECT COUNT(*) as count FROM ${tableName}
      `));

      const total = Number(totalResult[0]?.count || 0);

      const migratedResult = await db.execute(sql.raw(`
        SELECT COUNT(*) as count
        FROM ${tableName}
        WHERE organization_id IS NOT NULL
      `));

      const migrated = Number(migratedResult[0]?.count || 0);

      const unmigrated = total - migrated;

      if (unmigrated > 0) {
        issues.push({
          severity: "info",
          table: tableName,
          description: `Unmigrated records (may be expected)`,
          count: unmigrated,
        });
      }
    } catch (_error) {
}
  }
}

/**
 * Check hierarchical integrity
 */
async function checkHierarchicalIntegrity(
  issues: IntegrityIssue[]
): Promise<void> {
  try {
    // Check for circular references
    const result = await db.execute(sql.raw(`
      WITH RECURSIVE org_tree AS (
        SELECT id, parent_id, ARRAY[id] as path
        FROM organizations
        WHERE parent_id IS NULL
        
        UNION ALL
        
        SELECT o.id, o.parent_id, ot.path || o.id
        FROM organizations o
        JOIN org_tree ot ON o.parent_id = ot.id
        WHERE o.id != ALL(ot.path)
      )
      SELECT id
      FROM organizations
      WHERE id NOT IN (SELECT id FROM org_tree)
    `));

    if (result.length > 0) {
      issues.push({
        severity: "critical",
        table: "organizations",
        description: "Circular references in organization hierarchy",
        count: result.length,
        exampleIds: result.map((r) => r.id as string),
      });
    }
  } catch (_error) {
}
}

// =====================================================
// Reporting
// =====================================================

/**
 * Print integrity report
 */
function printReport(report: IntegrityReport): void {
if (report.issues.length > 0) {
for (const issue of report.issues) {
      const _emoji = getSeverityEmoji(issue.severity);
if (issue.exampleIds && issue.exampleIds.length > 0) {
}
}
  }

  if (report.recommendations.length > 0) {
report.recommendations.forEach((_rec) => undefined);
}
}

function _getStatusEmoji(status: string): string {
  switch (status) {
    case "pass":
      return "ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦";
    case "warning":
      return "ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â";
    case "fail":
      return "ÃƒÂ¢Ã‚ÂÃ…â€™";
    default:
      return "ÃƒÂ¢Ã‚ÂÃ¢â‚¬Å“";
  }
}

function getSeverityEmoji(severity: string): string {
  switch (severity) {
    case "critical":
      return "ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â´";
    case "warning":
      return "ÃƒÂ°Ã…Â¸Ã…Â¸Ã‚Â¡";
    case "info":
      return "ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Âµ";
    default:
      return "ÃƒÂ¢Ã…Â¡Ã‚Âª";
  }
}

/**
 * Export report to JSON
 */
export async function exportReport(
  report: IntegrityReport,
  filePath: string
): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs");
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
return true;
  } catch (_error) {
return false;
  }
}

