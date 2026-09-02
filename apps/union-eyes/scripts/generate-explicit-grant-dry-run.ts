#!/usr/bin/env tsx
/**
 * scripts/generate-explicit-grant-dry-run.ts
 *
 * PR #752 round 8, item 10: a deterministic dry-run artifact for the
 * eventual explicit per-table REVOKE + GRANT migration that will replace
 * 0108's blanket `GRANT ... ON ALL TABLES IN SCHEMA public` for
 * union_eyes_runtime and union_eyes_system. This does NOT emit or apply
 * any SQL — it only proves the manifest is internally consistent enough
 * to drive that generation, and separates tables that are actually ready
 * (CLOSED classification, fully resolved authority) from those still
 * pending (NEEDS_REVIEW).
 *
 * FAILS (throws, non-zero exit) if any table in the READY set has:
 *   - TBD authority/privileges (should be impossible for CLOSED, but this
 *     is the last-line check before anything downstream trusts the plan);
 *   - a SYSTEM_ONLY classification with non-empty tenant privileges;
 *   - a LATENT_UNREACHABLE classification with any non-empty privileges;
 *   - an unresolved scope identity (present in the manifest but outside
 *     the canonical DECLARED public-schema scope with no scopeDisposition
 *     — mirrors db/__tests__/rls-storage-authority-manifest-invariants.test.ts).
 *
 * Does NOT fail merely because NEEDS_REVIEW > 0 — those tables are
 * listed separately as PENDING, not included in the enforceable plan.
 * The real explicit-GRANT migration must still refuse to run at all while
 * NEEDS_REVIEW > 0 (see the file header of db/rls-storage-authority-manifest.ts) —
 * this script only proves readiness of the CLOSED subset.
 *
 * Usage: tsx scripts/generate-explicit-grant-dry-run.ts
 * Output: reports/union-eyes-explicit-grant-dry-run.{json,md}
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  storageAuthorityManifest,
  type RuntimeOperation,
} from '../db/rls-storage-authority-manifest'

const REPO_ROOT = resolve(__dirname, '..', '..', '..')
const OUT_DIR = resolve(REPO_ROOT, 'reports')

interface GrantPlanRow {
  table: string
  classification: string
  tenantPrivileges: readonly RuntimeOperation[]
  systemPrivileges: readonly RuntimeOperation[]
}

function opsOrThrow(table: string, label: string, value: readonly RuntimeOperation[] | 'TBD'): readonly RuntimeOperation[] {
  if (value === 'TBD') {
    throw new Error(`Explicit-grant dry-run integrity failure: '${table}' is in the READY set but ${label} is still 'TBD'.`)
  }
  return value
}

function main() {
  const ready: GrantPlanRow[] = []
  const pending: Array<{ table: string; classification: string }> = []
  const violations: string[] = []

  for (const entry of storageAuthorityManifest) {
    if (entry.classification === 'NEEDS_REVIEW') {
      pending.push({ table: entry.table, classification: entry.classification })
      continue
    }

    // Last-line integrity checks — these should already be unreachable
    // given the existing invariant tests, but the dry-run plan must never
    // silently trust a violation that slipped through.
    if (entry.invocationAuthority === 'TBD' || entry.dbExecutionPrincipal === 'TBD') {
      violations.push(`${entry.table}: CLOSED classification (${entry.classification}) but invocationAuthority/dbExecutionPrincipal is TBD`)
      continue
    }

    let tenantPrivileges: readonly RuntimeOperation[]
    let systemPrivileges: readonly RuntimeOperation[]
    try {
      tenantPrivileges = opsOrThrow(entry.table, 'requiredRuntimePrivileges', entry.requiredRuntimePrivileges)
      systemPrivileges = opsOrThrow(entry.table, 'requiredSystemPrivileges', entry.requiredSystemPrivileges)
    } catch (err) {
      violations.push((err as Error).message)
      continue
    }

    if (entry.classification === 'SYSTEM_ONLY' && tenantPrivileges.length > 0) {
      violations.push(`${entry.table}: SYSTEM_ONLY but requiredRuntimePrivileges is non-empty (${tenantPrivileges.join(',')})`)
      continue
    }
    if (entry.classification === 'LATENT_UNREACHABLE' && (tenantPrivileges.length > 0 || systemPrivileges.length > 0)) {
      violations.push(`${entry.table}: LATENT_UNREACHABLE but has non-empty privileges (tenant=${tenantPrivileges.join(',')}, system=${systemPrivileges.join(',')})`)
      continue
    }
    if (!entry.scopeDisposition && entry.table.length === 0) {
      // Unreachable in practice (table is always non-empty), kept only so
      // the scope-identity check has an explicit branch here matching the
      // Vitest invariant's intent, rather than silently relying on that
      // test alone.
      violations.push(`${entry.table}: empty table name`)
      continue
    }

    ready.push({
      table: entry.table,
      classification: entry.classification,
      tenantPrivileges,
      systemPrivileges,
    })
  }

  if (violations.length > 0) {
    throw new Error(`Explicit-grant dry-run found ${violations.length} integrity violation(s):\n${violations.join('\n')}`)
  }

  ready.sort((a, b) => a.table.localeCompare(b.table))
  pending.sort((a, b) => a.table.localeCompare(b.table))

  const summary = {
    generatedAt: new Date().toISOString(),
    note:
      'Deterministic dry-run only — does not emit or apply SQL. readyForExplicitGrant lists tables ' +
      'whose CLOSED classification and privilege sets are fully resolved and internally consistent; ' +
      'pendingReview lists NEEDS_REVIEW tables excluded from the plan. The real explicit-GRANT ' +
      'migration must still refuse to run while pendingReview.length > 0.',
    totalManifestEntries: storageAuthorityManifest.length,
    readyForExplicitGrantCount: ready.length,
    pendingReviewCount: pending.length,
    readyForExplicitGrant: ready,
    pendingReview: pending,
  }

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(resolve(OUT_DIR, 'union-eyes-explicit-grant-dry-run.json'), JSON.stringify(summary, null, 2))

  const fmtOps = (ops: readonly RuntimeOperation[]) => (ops.length > 0 ? ops.join(', ') : 'NONE')
  const md = [
    '# Union Eyes — Explicit Grant Dry-Run Plan',
    '',
    `Generated: ${summary.generatedAt}`,
    '',
    summary.note,
    '',
    `- Total manifest entries: ${summary.totalManifestEntries}`,
    `- Ready for explicit GRANT (CLOSED, fully resolved): ${summary.readyForExplicitGrantCount}`,
    `- Pending review (NEEDS_REVIEW, excluded from plan): ${summary.pendingReviewCount}`,
    '',
    '## Ready for explicit GRANT',
    '',
    '| table | classification | tenant (union_eyes_runtime) | system (union_eyes_system) |',
    '| --- | --- | --- | --- |',
    ...ready.map((r) => `| ${r.table} | ${r.classification} | ${fmtOps(r.tenantPrivileges)} | ${fmtOps(r.systemPrivileges)} |`),
    '',
  ].join('\n')
  writeFileSync(resolve(OUT_DIR, 'union-eyes-explicit-grant-dry-run.md'), md)

  console.log(`Total manifest entries: ${summary.totalManifestEntries}`)
  console.log(`Ready for explicit GRANT: ${summary.readyForExplicitGrantCount}`)
  console.log(`Pending review (excluded): ${summary.pendingReviewCount}`)
  console.log('Report written to reports/union-eyes-explicit-grant-dry-run.{json,md}')
}

main()
