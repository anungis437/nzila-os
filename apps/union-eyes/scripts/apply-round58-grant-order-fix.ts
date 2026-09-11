#!/usr/bin/env tsx
/**
 * apply-round58-grant-order-fix.ts — Round 59 corrective re-apply for the
 * grant-ordering regression discovered via the live RLS preflight against
 * staging (first successful live-principal run of scripts/rls-verify.ts).
 *
 * ROOT CAUSE: db/migrations/20260910_rls_enforcement_expansion_round58.sql
 * applies its 795 exact per-table GRANTs in "PART C" (lines ~2003-7970),
 * then — AFTER those grants — "PART E" unconditionally runs:
 *   REVOKE SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
 *     FROM union_eyes_runtime, union_eyes_system;
 *   REVOKE USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
 *     FROM union_eyes_runtime, union_eyes_system;
 * PART E's own comment says this "narrows" 0108's blanket grant down to
 * the exact PART C grants — but because it runs strictly AFTER PART C in
 * the same file/transaction, it instead wipes out every one of PART C's
 * grants, leaving union_eyes_runtime/union_eyes_system with NO table
 * privileges at all. This was not caught by apply-authority-enforcement-
 * migration.ts's post-apply sanity check because that check only counts
 * grant rows whose table no longer exists (always 0 — a vacuous check),
 * not whether the expected per-table grants are actually present. Live
 * proof: after round58 was applied to staging, rls-verify.ts --mode=
 * preflight failed with "permission denied for table organization_members"
 * as union_eyes_runtime, and a diagnostic query confirmed 0 rows in
 * information_schema.role_table_grants for that table/role.
 *
 * FIX: db/migrations/20260910_rls_enforcement_expansion_round58.sql is
 * treated as already-applied/historical (per this repo's forward-only
 * migration convention — never hand-edit or re-order an already-shipped
 * migration). This script instead re-applies ONLY PART C — verbatim,
 * extracted directly from that same file so there is a single source of
 * truth for the 795 per-table GRANT statements — as a new, separate,
 * atomic apply. Because this runs as a distinct migration step AFTER
 * round58 (and does not re-run PART E), the final state has the exact
 * per-table grants intact with no trailing blanket revoke.
 *
 * Required env: RLS_ENFORCEMENT_ADMIN_DATABASE_URL (or ADMIN_DATABASE_URL).
 * Never prints the connection string.
 */
import postgres from 'postgres'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

const SOURCE_MIGRATION_PATH = resolve(
  __dirname,
  '../db/migrations/20260910_rls_enforcement_expansion_round58.sql',
)

const PART_C_START_MARKER = '-- PART C — exact GRANT compiler'
const PART_D_START_MARKER = '-- PART D — targeted cleanup'

function extractPartC(fullMigrationSql: string): string {
  const startIdx = fullMigrationSql.indexOf(PART_C_START_MARKER)
  const endIdx = fullMigrationSql.indexOf(PART_D_START_MARKER)
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    throw new Error(
      `[apply-round58-grant-order-fix] Could not locate PART C markers in ${SOURCE_MIGRATION_PATH} ` +
        `(startIdx=${startIdx}, endIdx=${endIdx}). Refusing to apply — the source migration's structure ` +
        'may have changed since this fix was written.',
    )
  }
  return fullMigrationSql.slice(startIdx, endIdx)
}

async function main() {
  const adminUrl = process.env.RLS_ENFORCEMENT_ADMIN_DATABASE_URL || process.env.ADMIN_DATABASE_URL
  if (!adminUrl) {
    console.error('[apply-round58-grant-order-fix] Missing RLS_ENFORCEMENT_ADMIN_DATABASE_URL / ADMIN_DATABASE_URL.')
    process.exit(1)
  }

  const fullMigrationSql = readFileSync(SOURCE_MIGRATION_PATH, 'utf8')
  const partC = extractPartC(fullMigrationSql)
  const partCHash = createHash('sha256').update(partC).digest('hex')

  console.log(`[apply-round58-grant-order-fix] Re-applying PART C extracted from ${SOURCE_MIGRATION_PATH}`)
  console.log(`[apply-round58-grant-order-fix] PART C SHA-256: ${partCHash}`)
  console.log(`[apply-round58-grant-order-fix] PART C length: ${partC.length} bytes`)

  const sql = postgres(adminUrl, { ssl: adminUrl.includes('localhost') ? false : 'require', max: 1, prepare: false })

  try {
    await sql.unsafe(partC)
    console.log('[apply-round58-grant-order-fix] PART C re-applied without error (single implicit transaction).')

    const runtimeGrants = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM information_schema.role_table_grants
      WHERE grantee = 'union_eyes_runtime' AND table_schema = 'public'`
    console.log(`[apply-round58-grant-order-fix] union_eyes_runtime now has ${runtimeGrants[0].n} table-grant rows.`)

    const orgMembersGrant = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM information_schema.role_table_grants
      WHERE grantee = 'union_eyes_runtime' AND table_schema = 'public' AND table_name = 'organization_members'`
    console.log(
      `[apply-round58-grant-order-fix] union_eyes_runtime grants on organization_members: ${orgMembersGrant[0].n} (expect > 0).`,
    )

    if (runtimeGrants[0].n === 0 || orgMembersGrant[0].n === 0) {
      console.error(
        '[apply-round58-grant-order-fix] Post-apply sanity check failed: expected per-table grants are still missing after re-applying PART C.',
      )
      process.exit(1)
    }

    console.log('[apply-round58-grant-order-fix] Grant-order regression fix applied and verified.')
  } finally {
    await sql.end({ timeout: 2 })
  }
}

main().catch((err) => {
  console.error('[apply-round58-grant-order-fix] Unhandled error:', err?.message ?? err)
  process.exit(1)
})
