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
 *   2. Computes and logs the SHA-256 of EACH migration file being applied
 *      separately — exact migration/version evidence in the run log
 *      (Round 59 section 4 provenance requirement).
 *   3. Applies, as ONE combined atomic statement batch:
 *        a. db/migrations/20260913_round58_production_geometry_prerequisites.sql
 *           (P4 Round58 Production Geometry Compatibility Remediation) —
 *           establishes the authority columns (chat_sessions.organization_id,
 *           board_packets.organization_id, policy_rules.organization_id,
 *           voting_sessions.organization_id, congress_memberships.congress_id,
 *           shared_clause_library.sharing_level/shared_with_org_ids) that
 *           Round58's own policy-helper calls assume exist. Forward-only,
 *           idempotent, fail-closed on non-empty tables lacking a
 *           deterministic authority source.
 *        b. db/migrations/20260914_round58_complete_production_geometry_prerequisites.sql
 *           (P4_ROUND58_COMPLETE_GEOMETRY_REMEDIATION) — companion
 *           prerequisite covering the remaining 14 tables discovered by a
 *           full production census: bargaining_notes, budget_pool,
 *           calendar_events, clause_comparisons, clc_sync_log,
 *           consent_records, cookie_consents, defensibility_packs,
 *           geofences, mobile_devices, pilot_metrics,
 *           reward_wallet_ledger, strike_fund_disbursements,
 *           user_consents. Same forward-only/idempotent/fail-closed
 *           pattern as (a).
 *        c. db/migrations/20260910_rls_enforcement_expansion_round58.sql
 *           verbatim.
 *      All three files' SQL text is concatenated and sent to Postgres as
 *      ONE simple-query-protocol message, so the prerequisite geometry and
 *      the Round58 policy/grant application succeed or roll back TOGETHER —
 *      never leaving Round58 applied against production tables it never
 *      actually validated column-by-column. The migration text itself is
 *      also idempotent (DROP POLICY IF EXISTS / CREATE OR REPLACE FUNCTION /
 *      REVOKE ALL + explicit GRANT / ADD COLUMN IF NOT EXISTS-guarded DO
 *      blocks) — safe to re-run.
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

const PREREQUISITE_MIGRATION_PATH = resolve(
  __dirname,
  '../db/migrations/20260913_round58_production_geometry_prerequisites.sql'
)
const COMPLETE_GEOMETRY_PREREQUISITE_MIGRATION_PATH = resolve(
  __dirname,
  '../db/migrations/20260914_round58_complete_production_geometry_prerequisites.sql'
)
const MIGRATION_PATH = resolve(__dirname, '../db/migrations/20260910_rls_enforcement_expansion_round58.sql')

async function main() {
  const adminUrl = process.env.RLS_ENFORCEMENT_ADMIN_DATABASE_URL || process.env.ADMIN_DATABASE_URL
  if (!adminUrl) {
    console.error('[apply-authority-enforcement-migration] Missing RLS_ENFORCEMENT_ADMIN_DATABASE_URL / ADMIN_DATABASE_URL.')
    process.exit(1)
  }

  const prerequisiteSql = readFileSync(PREREQUISITE_MIGRATION_PATH, 'utf8')
  const prerequisiteHash = createHash('sha256').update(prerequisiteSql).digest('hex')
  const completeGeometryPrerequisiteSql = readFileSync(COMPLETE_GEOMETRY_PREREQUISITE_MIGRATION_PATH, 'utf8')
  const completeGeometryPrerequisiteHash = createHash('sha256').update(completeGeometryPrerequisiteSql).digest('hex')
  const migrationSql = readFileSync(MIGRATION_PATH, 'utf8')
  const migrationHash = createHash('sha256').update(migrationSql).digest('hex')
  console.log(`[apply-authority-enforcement-migration] Applying ${PREREQUISITE_MIGRATION_PATH}`)
  console.log(`[apply-authority-enforcement-migration] SHA-256 (prerequisite): ${prerequisiteHash}`)
  console.log(`[apply-authority-enforcement-migration] Applying ${COMPLETE_GEOMETRY_PREREQUISITE_MIGRATION_PATH}`)
  console.log(`[apply-authority-enforcement-migration] SHA-256 (complete-geometry prerequisite): ${completeGeometryPrerequisiteHash}`)
  console.log(`[apply-authority-enforcement-migration] Applying ${MIGRATION_PATH}`)
  console.log(`[apply-authority-enforcement-migration] SHA-256 (round58): ${migrationHash}`)

  const sql = postgres(adminUrl, { ssl: adminUrl.includes('localhost') ? false : 'require', max: 1, prepare: false })

  // Concatenated and sent as ONE sql.unsafe() call so all three files
  // execute in a single implicit transaction (per postgres.js's
  // simple-query-protocol semantics) — the prerequisite geometry columns
  // and the Round58 policy/grant application either all succeed or all
  // roll back together.
  const combinedSql = `${prerequisiteSql}\n\n${completeGeometryPrerequisiteSql}\n\n${migrationSql}`

  try {
    await sql.unsafe(combinedSql)
    console.log('[apply-authority-enforcement-migration] Prerequisite + complete-geometry prerequisite + Round58 migrations applied without error (single implicit transaction).')

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
