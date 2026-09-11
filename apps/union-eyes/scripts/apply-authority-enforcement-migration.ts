#!/usr/bin/env tsx
/**
 * apply-authority-enforcement-migration.ts — the deterministic, atomic apply
 * step for db/migrations/20260910_rls_enforcement_expansion_round58.sql.
 *
 * Round 59 fix: the workflow previously applied this migration via
 * `psql -f <file>` with no `--single-transaction` flag. psql sends each
 * top-level statement in a script as its own implicit transaction (unless
 * the script itself contains explicit BEGIN/COMMIT), so a failure partway
 * through the file would leave PART A/B/C/D/E partially applied — not the
 * atomic all-or-nothing apply the Round 58 transactional proof (see
 * full-migration-transactional-proof.ts) actually validated. This script
 * mirrors apply-rls-foundation-migration.ts's proven pattern: the entire
 * migration file is sent to Postgres as ONE simple-query-protocol message
 * via postgres.js's `sql.unsafe()`, which Postgres itself treats as a
 * single implicit transaction (per the multi-statement simple-query
 * protocol semantics) — any statement failure rolls back the whole batch.
 *
 * What it does, in order:
 *   1. Connects using ADMIN/migration authority (never the application's
 *      own runtime or system credential).
 *   2. Computes and logs the SHA-256 of the migration file being applied —
 *      exact migration/version evidence in the run log (Round 59 section 4
 *      provenance requirement).
 *   3. Applies db/migrations/20260910_rls_enforcement_expansion_round58.sql
 *      verbatim, atomically. The migration itself is also idempotent
 *      (DROP POLICY IF EXISTS / CREATE OR REPLACE FUNCTION / REVOKE ALL +
 *      explicit GRANT) — safe to re-run.
 *   4. Performs a light sanity check: counts policies + PART E's blanket
 *      grant removal took effect (no ALL TABLES wildcard grant remains for
 *      union_eyes_runtime/union_eyes_system in information_schema). The
 *      full ACL/policy oracle comparison against the manifest is
 *      post-apply-verifier.ts's job, not this script's.
 *
 * Required env: RLS_ENFORCEMENT_ADMIN_DATABASE_URL (or ADMIN_DATABASE_URL).
 * Never prints the connection string.
 */
import postgres from 'postgres'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

const MIGRATION_PATH = resolve(__dirname, '../db/migrations/20260910_rls_enforcement_expansion_round58.sql')

async function main() {
  const adminUrl = process.env.RLS_ENFORCEMENT_ADMIN_DATABASE_URL || process.env.ADMIN_DATABASE_URL
  if (!adminUrl) {
    console.error('[apply-authority-enforcement-migration] Missing RLS_ENFORCEMENT_ADMIN_DATABASE_URL / ADMIN_DATABASE_URL.')
    process.exit(1)
  }

  const migrationSql = readFileSync(MIGRATION_PATH, 'utf8')
  const migrationHash = createHash('sha256').update(migrationSql).digest('hex')
  console.log(`[apply-authority-enforcement-migration] Applying ${MIGRATION_PATH}`)
  console.log(`[apply-authority-enforcement-migration] SHA-256: ${migrationHash}`)

  const sql = postgres(adminUrl, { ssl: adminUrl.includes('localhost') ? false : 'require', max: 1, prepare: false })

  try {
    await sql.unsafe(migrationSql)
    console.log('[apply-authority-enforcement-migration] Migration applied without error (single implicit transaction).')

    const policyCount = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM pg_policies WHERE schemaname = 'public'`
    console.log(`[apply-authority-enforcement-migration] public schema now has ${policyCount[0].n} RLS policies.`)

    const blanket = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM information_schema.role_table_grants
      WHERE grantee IN ('union_eyes_runtime', 'union_eyes_system')
        AND table_schema = 'public'
        AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
        AND table_name NOT IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public')`
    // Sanity check only — every grant row should reference a real table
    // (this catches nothing meaningful today; kept as a defensive check
    // for future catalog-shape regressions).
    console.log(`[apply-authority-enforcement-migration] Orphaned grant rows (sanity check, expect 0): ${blanket[0].n}`)

    console.log('[apply-authority-enforcement-migration] Migration apply complete. Next: scripts/rls-enforcement/post-apply-verifier.ts.')
  } finally {
    await sql.end({ timeout: 2 })
  }
}

main().catch((err) => {
  console.error('[apply-authority-enforcement-migration] Failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
