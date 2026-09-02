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

const REPO_ROOT = resolve(__dirname, '..', '..', '..')
const MIGRATION_0108 = resolve(__dirname, '..', 'db', 'migrations', '0108_rls_tenant_isolation_foundation.sql')
const OUT_DIR = resolve(REPO_ROOT, 'reports')

function get0108ProtectedTables(): Set<string> {
  const sql = readFileSync(MIGRATION_0108, 'utf8')
  const tables = new Set<string>()
  for (const m of sql.matchAll(/ue_create_[a-z_]+_rls_policy\('([a-z_]+)'\)/g)) tables.add(m[1]!)
  for (const m of sql.matchAll(/ALTER TABLE "?([a-z_]+)"? ENABLE ROW LEVEL SECURITY/g)) tables.add(m[1]!)
  return tables
}

function isTbdOps(v: readonly string[] | 'TBD'): boolean {
  return v === 'TBD'
}

function main() {
  const protected0108 = get0108ProtectedTables()
  const closed = new Set<StorageAuthorityClassification>(CLOSED_CLASSIFICATIONS)

  const byClassification: Record<string, number> = {}
  let needsReview = 0
  let invocationTbd = 0
  let dbPrincipalTbd = 0
  let runtimeTbd = 0
  let systemTbd = 0
  let systemOnlyExposedToTenant = 0
  let latentExposedToAnyRole = 0
  const tenantRlsMissing0108: string[] = []
  const parentOwnedMissingPolicy: string[] = []
  const userRlsMissingPolicy: string[] = []
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

    if (entry.classification === 'TENANT_RLS_REQUIRED' && !protected0108.has(entry.table)) {
      tenantRlsMissing0108.push(entry.table)
    }
    if (entry.classification === 'PARENT_OWNED_RLS_REQUIRED' && !protected0108.has(entry.table)) {
      parentOwnedMissingPolicy.push(entry.table)
    }
    if (entry.classification === 'USER_RLS_REQUIRED' && !protected0108.has(entry.table)) {
      userRlsMissingPolicy.push(entry.table)
    }

    if (
      closed.has(entry.classification) &&
      entry.classification !== 'NEEDS_REVIEW' &&
      (entry.invocationAuthority === 'TBD' || entry.dbExecutionPrincipal === 'TBD')
    ) {
      closedWithTbdAuthority.push(entry.table)
    }
  }

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
    },
    invariantViolations: {
      systemOnlyExposedToTenantRuntime: systemOnlyExposedToTenant,
      latentUnreachableExposedToAnyRole: latentExposedToAnyRole,
    },
    policyGaps: {
      note: '0108-protected-table detection is a best-effort static scan of ue_create_*_rls_policy() calls and ENABLE ROW LEVEL SECURITY statements in the 0108 migration SQL, not a live database introspection.',
      tenantRlsRequiredMissing0108Coverage: tenantRlsMissing0108.length,
      parentOwnedRlsRequiredMissingPolicy: parentOwnedMissingPolicy.length,
      userRlsRequiredMissingPolicy: userRlsMissingPolicy.length,
    },
    blanketGrantBlocker:
      'union_eyes_runtime still holds GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public (0108). ' +
      'REVOKE + explicit per-table GRANT generation from this manifest cannot proceed while NEEDS_REVIEW > 0 or any closed-classification entry has TBD authority/privileges.',
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
    `- Closed (non-NEEDS_REVIEW) entries still carrying TBD authority: ${closedWithTbdAuthority.length}`,
    '',
    '## Invariant violations (must always be zero)',
    '',
    `- SYSTEM_ONLY exposed to TENANT_RUNTIME/MIXED: ${systemOnlyExposedToTenant}`,
    `- LATENT_UNREACHABLE exposed to any DB role: ${latentExposedToAnyRole}`,
    '',
    '## Policy gaps (best-effort static scan of 0108)',
    '',
    `- TENANT_RLS_REQUIRED without detected 0108 coverage: ${tenantRlsMissing0108.length}`,
    `- PARENT_OWNED_RLS_REQUIRED without detected policy: ${parentOwnedMissingPolicy.length}`,
    `- USER_RLS_REQUIRED without detected policy: ${userRlsMissingPolicy.length}`,
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
  console.log(`SYSTEM_ONLY exposed to tenant runtime: ${systemOnlyExposedToTenant}`)
  console.log(`LATENT_UNREACHABLE exposed to any role: ${latentExposedToAnyRole}`)
  console.log('Report written to reports/union-eyes-authority-convergence-report.{json,md}')
}

main()
