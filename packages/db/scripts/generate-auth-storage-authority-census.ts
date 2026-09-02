#!/usr/bin/env tsx
/**
 * generate-auth-storage-authority-census.ts
 *
 * Deterministic report over packages/db/src/auth-storage-authority/'s
 * registry for the shared `user_management` PostgreSQL schema. Read-only
 * — inspects only source-controlled files, never a live database (see
 * packages/db/src/auth-storage-authority/types.ts for why live RLS/GRANT
 * verification isn't possible in this environment).
 *
 * Deliberately a SEPARATE report from apps/union-eyes's
 * reports/union-eyes-authority-convergence-report.{json,md} (PUBLIC
 * schema) — see PR #752 round 13. Final database readiness requires BOTH
 * reports to converge, not just the public one.
 *
 * Usage: tsx packages/db/scripts/generate-auth-storage-authority-census.ts
 * Output: reports/auth-storage-authority-census.{json,md}
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { authStorageAuthorityEntries } from '../src/auth-storage-authority/entries'
import type {
  AuthStorageAuthorityClassification,
  AuthDbExecutionPrincipal,
} from '../src/auth-storage-authority/types'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..', '..', '..')
const OUT_DIR = resolve(REPO_ROOT, 'reports')

function main() {
  const total = authStorageAuthorityEntries.length

  const byClassification: Record<string, number> = {}
  const byExecutionPrincipal: Record<string, number> = {}
  let authSystemOnlyExposedToRuntime = 0

  for (const entry of authStorageAuthorityEntries) {
    byClassification[entry.classification] = (byClassification[entry.classification] ?? 0) + 1
    byExecutionPrincipal[entry.dbExecutionPrincipal] = (byExecutionPrincipal[entry.dbExecutionPrincipal] ?? 0) + 1
    if (entry.classification === ('AUTH_SYSTEM_ONLY' satisfies AuthStorageAuthorityClassification) &&
        entry.dbExecutionPrincipal === ('AUTH_RUNTIME' satisfies AuthDbExecutionPrincipal)) {
      authSystemOnlyExposedToRuntime += 1
    }
  }

  // Every entry here was hand-traced with real evidence (no TBD field
  // exists in this registry's type at all) — so "needs review" is always
  // 0 for entries that exist; the only meaningful gap is a table present
  // in packages/db/src/schema/auth.ts with NO entry at all, caught by
  // packages/db/src/auth-storage-authority/__tests__/registry-invariants
  // .test.ts's exact-count check, not by this report.
  const needsReview = 0

  const summary = {
    generatedAt: new Date().toISOString(),
    schema: 'user_management',
    total,
    needsReview,
    byClassification,
    byExecutionPrincipal,
    invariantViolations: {
      authSystemOnlyExposedToRuntime,
    },
    tables: authStorageAuthorityEntries.map((e) => ({
      table: e.table,
      classification: e.classification,
      invocationAuthority: e.invocationAuthority,
      dbExecutionPrincipal: e.dbExecutionPrincipal,
    })),
  }

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(resolve(OUT_DIR, 'auth-storage-authority-census.json'), JSON.stringify(summary, null, 2) + '\n')

  const md = [
    '# Auth Storage Authority Census (user_management schema)',
    '',
    `Generated: ${summary.generatedAt}`,
    '',
    'PR #752 round 13: separate authority surface from apps/union-eyes\'s',
    'public-schema registry — see',
    'packages/db/src/auth-storage-authority/types.ts for why.',
    '',
    `- Total tables: ${total}`,
    `- Needs review: ${needsReview}`,
    `- AUTH_SYSTEM_ONLY exposed to AUTH_RUNTIME (invariant violation): ${authSystemOnlyExposedToRuntime}`,
    '',
    '## By classification',
    '',
    ...Object.entries(byClassification).map(([k, v]) => `- ${k}: ${v}`),
    '',
    '## By DB execution principal',
    '',
    ...Object.entries(byExecutionPrincipal).map(([k, v]) => `- ${k}: ${v}`),
    '',
    '## Tables',
    '',
    '| Table | Classification | Invocation Authority | DB Execution Principal |',
    '|---|---|---|---|',
    ...authStorageAuthorityEntries.map(
      (e) => `| ${e.table} | ${e.classification} | ${e.invocationAuthority} | ${e.dbExecutionPrincipal} |`,
    ),
    '',
  ].join('\n')

  writeFileSync(resolve(OUT_DIR, 'auth-storage-authority-census.md'), md)

  console.log(`Total tables: ${total}`)
  console.log(`Needs review: ${needsReview}`)
  console.log(`AUTH_SYSTEM_ONLY exposed to AUTH_RUNTIME: ${authSystemOnlyExposedToRuntime}`)
  console.log('Report written to reports/auth-storage-authority-census.{json,md}')
}

main()
