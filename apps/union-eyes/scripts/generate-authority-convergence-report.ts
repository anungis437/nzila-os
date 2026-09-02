#!/usr/bin/env tsx
/**
 * generate-authority-convergence-report.ts
 *
 * Deterministic report of remaining distance to the final
 * REVOKE-blanket-grants / explicit-per-role-GRANT convergence for
 * db/rls-storage-authority-manifest.ts. Read-only — inspects only
 * source-controlled files (the manifest + 0108's migration SQL), never a
 * live database.
 *
 * Usage: tsx scripts/generate-authority-convergence-report.ts
 * Output: reports/union-eyes-authority-convergence-report.{json,md}
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  storageAuthorityManifest,
  CLOSED_CLASSIFICATIONS,
  type StorageAuthorityClassification,
} from '../db/rls-storage-authority-manifest'
import { ALL_0108_PROTECTED_TABLES } from '../db/rls-0108-protected-tables'
import { scanMigrationSqlForProtectedTables } from '../db/rls-0108-migration-sql-scan'

const REPO_ROOT = resolve(__dirname, '..', '..', '..')
const MIGRATION_0108 = resolve(__dirname, '..', 'db', 'migrations', '0108_rls_tenant_isolation_foundation.sql')
const OUT_DIR = resolve(REPO_ROOT, 'reports')

// Best-effort static scan of the 0108 migration SQL — used ONLY to check
// migration-vs-baseline-list consistency (see baselineTablesMissingFromMigration
// below), never as the primary "is this table 0108-protected" answer. The
// primary answer is db/rls-0108-protected-tables.ts's ALL_0108_PROTECTED_TABLES
// (round 5: extracted as the single source of truth shared with
// scripts/rls-verify.ts, replacing this file's own former regex-derived set).
// Round 6: the scan itself moved to db/rls-0108-migration-sql-scan.ts after
// its original regex here produced 7 false positives on multi-arg helper
// calls — see that module's own doc comment and dedicated test.
function get0108TablesMentionedInMigrationSql(): Set<string> {
  const sql = readFileSync(MIGRATION_0108, 'utf8')
  return scanMigrationSqlForProtectedTables(sql)
}

function isTbdOps(v: readonly string[] | 'TBD'): boolean {
  return v === 'TBD'
}

function main() {
  const baseline0108 = new Set<string>(ALL_0108_PROTECTED_TABLES)
  const mentionedInMigrationSql = get0108TablesMentionedInMigrationSql()
  const closed = new Set<StorageAuthorityClassification>(CLOSED_CLASSIFICATIONS)

  const byClassification: Record<string, number> = {}
  let needsReview = 0
  let invocationTbd = 0
  let dbPrincipalTbd = 0
  let runtimeTbd = 0
  let systemTbd = 0
  let systemOnlyExposedToTenant = 0
  let latentExposedToAnyRole = 0
  // RLS_POLICY_EXPANSION_REQUIRED: manifest-discovered tables that are NOT
  // part of 0108's original 24-table baseline but are classified as
  // needing the same kind of RLS policy treatment. This is expansion
  // (new policy debt to pay down), not evidence that 0108 lost coverage
  // of its own original set — those are two different, deliberately
  // separated questions (round-5 review item 5).
  const tenantRlsExpansionRequired: string[] = []
  const parentOwnedExpansionRequired: string[] = []
  const userRlsExpansionRequired: string[] = []
  const closedWithTbdAuthority: string[] = []

  for (const entry of storageAuthorityManifest) {
    byClassification[entry.classification] = (byClassification[entry.classification] ?? 0) + 1
    if (entry.classification === 'NEEDS_REVIEW') needsReview += 1
    if (entry.invocationAuthority === 'TBD') invocationTbd += 1
    if (entry.dbExecutionPrincipal === 'TBD') dbPrincipalTbd += 1
    if (isTbdOps(entry.requiredRuntimePrivileges)) runtimeTbd += 1
    if (isTbdOps(entry.requiredSystemPrivileges)) systemTbd += 1

    if (entry.classification === 'SYSTEM_ONLY') {
      if (entry.dbExecutionPrincipal === 'TENANT_RUNTIME' || entry.dbExecutionPrincipal === 'MIXED') {
        systemOnlyExposedToTenant += 1
      }
    }
    if (entry.classification === 'LATENT_UNREACHABLE') {
      if (entry.dbExecutionPrincipal !== 'NONE') latentExposedToAnyRole += 1
    }

    if (entry.classification === 'TENANT_RLS_REQUIRED' && !baseline0108.has(entry.table)) {
      tenantRlsExpansionRequired.push(entry.table)
    }
    if (entry.classification === 'PARENT_OWNED_RLS_REQUIRED' && !baseline0108.has(entry.table)) {
      parentOwnedExpansionRequired.push(entry.table)
    }
    if (entry.classification === 'USER_RLS_REQUIRED' && !baseline0108.has(entry.table)) {
      userRlsExpansionRequired.push(entry.table)
    }

    // Blanket invariant (round 5): 'TBD' in ANY of the four
    // authority/privilege fields is disqualifying for a CLOSED
    // classification, matching db/__tests__/rls-storage-authority-manifest-invariants.test.ts's
    // "every CLOSED classification has fully resolved authority" test.
    if (
      closed.has(entry.classification) &&
      (
        entry.invocationAuthority === 'TBD' ||
        entry.dbExecutionPrincipal === 'TBD' ||
        entry.requiredRuntimePrivileges === 'TBD' ||
        entry.requiredSystemPrivileges === 'TBD'
      )
    ) {
      closedWithTbdAuthority.push(entry.table)
    }
  }

  // Bidirectional 0108 baseline consistency (round 5 item 5): prove BOTH
  // directions instead of only ever checking "is this manifest table
  // 0108-covered" (which conflates the two different questions the
  // review flagged).
  const baselineTablesMissingFromMigrationSql = [...baseline0108].filter((t) => !mentionedInMigrationSql.has(t))
  const baselineTablesWithoutManifestDisposition = [...baseline0108].filter(
    (t) => !storageAuthorityManifest.some((e) => e.table === t),
  )

  const summary = {
    generatedAt: new Date().toISOString(),
    totalTables: storageAuthorityManifest.length,
    byClassification,
    needsReview,
    authorityModel: {
      invocationAuthorityTbd: invocationTbd,
      dbExecutionPrincipalTbd: dbPrincipalTbd,
      requiredRuntimePrivilegesTbd: runtimeTbd,
      requiredSystemPrivilegesTbd: systemTbd,
      closedClassificationWithTbdAuthorityCount: closedWithTbdAuthority.length,
      closedClassificationWithTbdAuthorityTables: closedWithTbdAuthority,
    },
    invariantViolations: {
      systemOnlyExposedToTenantRuntime: systemOnlyExposedToTenant,
      latentUnreachableExposedToAnyRole: latentExposedToAnyRole,
    },
    zeroOneZeroEightBaseline: {
      note:
        "The ORIGINAL 0108 protected-table set, sourced from db/rls-0108-protected-tables.ts (shared with scripts/rls-verify.ts — single source of truth, not a parallel hand-maintained list). " +
        'This section answers "did 0108 keep its own original coverage", which is a DIFFERENT question from rlsPolicyExpansionRequired below ("what NEW tables does the manifest say need the same treatment").',
      originalProtectedTableCount: baseline0108.size,
      baselineTablesMissingFromMigrationSql: baselineTablesMissingFromMigrationSql.length,
      baselineTablesMissingFromMigrationSqlList: baselineTablesMissingFromMigrationSql,
      baselineTablesWithoutManifestDisposition: baselineTablesWithoutManifestDisposition.length,
      baselineTablesWithoutManifestDispositionList: baselineTablesWithoutManifestDisposition,
    },
    rlsPolicyExpansionRequired: {
      note:
        'Tables classified as needing RLS policy treatment (TENANT_RLS_REQUIRED / PARENT_OWNED_RLS_REQUIRED / USER_RLS_REQUIRED) that are NOT part of the original 24-table 0108 baseline above — i.e. genuinely additional policy debt discovered by this manifest, to be added via a follow-up migration before REVOKE-ing blanket grants. Renamed from the round-4 "policyGaps" wording, which conflated this with 0108 losing its own coverage.',
      tenantRlsRequiredExpansionCount: tenantRlsExpansionRequired.length,
      tenantRlsRequiredExpansionTables: tenantRlsExpansionRequired,
      parentOwnedRlsRequiredExpansionCount: parentOwnedExpansionRequired.length,
      parentOwnedRlsRequiredExpansionTables: parentOwnedExpansionRequired,
      userRlsRequiredExpansionCount: userRlsExpansionRequired.length,
      userRlsRequiredExpansionTables: userRlsExpansionRequired,
      totalExpansionCount: tenantRlsExpansionRequired.length + parentOwnedExpansionRequired.length + userRlsExpansionRequired.length,
    },
    blanketGrantBlocker:
      'union_eyes_runtime still holds GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public (0108). ' +
      'REVOKE + explicit per-table GRANT generation from this manifest cannot proceed while NEEDS_REVIEW > 0, any closed-classification entry has TBD authority/privileges, or rlsPolicyExpansionRequired\'s tables lack an actual migration adding their RLS policy.',
  }

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(resolve(OUT_DIR, 'union-eyes-authority-convergence-report.json'), JSON.stringify(summary, null, 2))

  const md = [
    '# Union Eyes — Storage Authority Convergence Report',
    '',
    `Generated: ${summary.generatedAt}`,
    '',
    '## Classification counts',
    '',
    '| Classification | Count |',
    '| --- | --- |',
    ...Object.entries(byClassification).map(([k, v]) => `| ${k} | ${v} |`),
    '',
    '## Authority-model convergence (invocationAuthority / dbExecutionPrincipal / privileges)',
    '',
    `- invocationAuthority = TBD: ${invocationTbd}`,
    `- dbExecutionPrincipal = TBD: ${dbPrincipalTbd}`,
    `- requiredRuntimePrivileges = TBD: ${runtimeTbd}`,
    `- requiredSystemPrivileges = TBD: ${systemTbd}`,
    `- Closed (non-NEEDS_REVIEW) entries still carrying TBD in ANY of the four fields: ${closedWithTbdAuthority.length}`,
    '',
    '## Invariant violations (must always be zero)',
    '',
    `- SYSTEM_ONLY exposed to TENANT_RUNTIME/MIXED: ${systemOnlyExposedToTenant}`,
    `- LATENT_UNREACHABLE exposed to any DB role: ${latentExposedToAnyRole}`,
    '',
    '## 0108 original baseline (24-table protected set) — bidirectional consistency',
    '',
    `- Original 0108-protected table count (source of truth: db/rls-0108-protected-tables.ts): ${baseline0108.size}`,
    `- Baseline tables NOT mentioned in the 0108 migration SQL itself (drift/typo check): ${baselineTablesMissingFromMigrationSql.length}`,
    `- Baseline tables with NO entry in this manifest at all (coverage gap check): ${baselineTablesWithoutManifestDisposition.length}`,
    '',
    '## RLS policy expansion required (NEW tables beyond the 0108 baseline, NOT evidence 0108 lost coverage)',
    '',
    `- TENANT_RLS_REQUIRED tables beyond the 0108 baseline: ${tenantRlsExpansionRequired.length}`,
    `- PARENT_OWNED_RLS_REQUIRED tables beyond the 0108 baseline: ${parentOwnedExpansionRequired.length}`,
    `- USER_RLS_REQUIRED tables beyond the 0108 baseline: ${userRlsExpansionRequired.length}`,
    `- Total additional policy-expansion tables: ${summary.rlsPolicyExpansionRequired.totalExpansionCount}`,
    '',
    '## Blanket grant blocker',
    '',
    summary.blanketGrantBlocker,
    '',
  ].join('\n')
  writeFileSync(resolve(OUT_DIR, 'union-eyes-authority-convergence-report.md'), md)

  console.log(`NEEDS_REVIEW: ${needsReview}`)
  console.log(`invocationAuthority TBD: ${invocationTbd}`)
  console.log(`dbExecutionPrincipal TBD: ${dbPrincipalTbd}`)
  console.log(`Closed classification with TBD (any field): ${closedWithTbdAuthority.length}`)
  console.log(`SYSTEM_ONLY exposed to tenant runtime: ${systemOnlyExposedToTenant}`)
  console.log(`LATENT_UNREACHABLE exposed to any role: ${latentExposedToAnyRole}`)
  console.log(`0108 baseline: ${baseline0108.size} tables; RLS policy expansion required: ${summary.rlsPolicyExpansionRequired.totalExpansionCount} tables`)
  console.log('Report written to reports/union-eyes-authority-convergence-report.{json,md}')
}

main()
