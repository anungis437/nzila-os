#!/usr/bin/env tsx
/**
 * apply-round59-rls-geometry-gap-closure.ts — Round 59B corrective re-apply
 * for a 3-table RLS/policy geometry gap discovered via
 * scripts/rls-enforcement/post-apply-verifier.ts run against staging after
 * the round-58 migration + round-58 grant-order fix were both already
 * applied (986/986 rls-verify.ts preflight checks passing did NOT catch
 * this — that check only walks the manifest's classification-driven
 * expectations for tables rls-verify.ts itself probes; post-apply-
 * verifier.ts is the wider oracle that walks the FULL storageAuthorityManifest
 * and caught 21 missing checks across exactly 3 tables).
 *
 * ROOT CAUSE (two distinct causes, same symptom):
 *
 * 1. `pilot_applications` (guard column `verified_organization_id`) and
 *    `strike_fund_disbursements` (guard column `organization_id`) — both
 *    columns exist in staging today, but were added by migrations dated
 *    AFTER db/migrations/20260910_rls_enforcement_expansion_round58.sql's
 *    one-time guarded application already ran in staging (round-58 is a
 *    one-time-rollout workflow job; it does not re-run once marked
 *    applied). At the moment round-58 first ran, PART B's
 *    `to_regclass(...) IS NOT NULL AND EXISTS(...column...)` guard for
 *    each of these two tables evaluated FALSE, so
 *    `ue_create_direct_org_rls_policy(...)` was never invoked for them —
 *    a migration-ordering/deployment-drift gap, not a logic defect.
 *
 * 2. `automation_rules` — a genuine migration-source column-name defect.
 *    The frozen migration's guard checks for column `org_id`, but the
 *    canonical ownership column is varchar(255) `organization_id`. P3.2
 *    reconciled all four competing Drizzle declarations and added the
 *    forward-only Django core migration that materializes the ownership
 *    column only when the table is empty. The migration refuses rows that
 *    would require an unproven ownership backfill.
 *
 *    The rewards automation service retains its `orgId` TypeScript property
 *    alias, but that alias now resolves to physical `organization_id` in both
 *    rewards schema surfaces. Broader convergence of the two historical
 *    automation-rule column families remains separate from this ownership
 *    correction.
 *
 * FIX: re-invoke the already-idempotent, already-proven
 * `ue_create_direct_org_rls_policy(table, column, isText)` function (defined
 * in db/migrations/0108_rls_tenant_isolation_foundation.sql, persists as a
 * normal Postgres function — never dropped) directly for these tables
 * with the CORRECT real column names. Does not edit any frozen migration
 * file (forward-only convention).
 *
 * NOT INCLUDED HERE: `strike_fund_disbursements`. Its guard column
 * (organization_id) does not exist in staging at all —
 * db/migrations/20260909_strike_fund_disbursements_organization_id.sql was
 * never applied there. Re-running scripts/verify-strike-fund-org-backfill.ts
 * against staging (Round 59B) shows rowCount=2, mappedCount=0,
 * ambiguousCount=0, unmappedCount=2 — i.e. BOTH real staging rows are
 * unmapped, so that migration's own deliberate RAISE EXCEPTION safety
 * check would correctly refuse to proceed. This is the same pre-existing
 * data-provenance gap already flagged before round 58/59 — not a new
 * defect, not safe to force through with a fallback/default mapping, and
 * therefore intentionally left as a standing Round-59B blocker rather
 * than closed by this script.
 *
 * Required env: RLS_ENFORCEMENT_ADMIN_DATABASE_URL (or ADMIN_DATABASE_URL).
 * Never prints the connection string.
 */
import postgres from 'postgres'

const GAPS: Array<{ table: string; column: string; isText: boolean }> = [
  { table: 'pilot_applications', column: 'verified_organization_id', isText: false },
  { table: 'automation_rules', column: 'organization_id', isText: true },
]

async function main() {
  const adminUrl = process.env.RLS_ENFORCEMENT_ADMIN_DATABASE_URL || process.env.ADMIN_DATABASE_URL
  if (!adminUrl) {
    console.error('[apply-round59-rls-geometry-gap-closure] Missing RLS_ENFORCEMENT_ADMIN_DATABASE_URL / ADMIN_DATABASE_URL.')
    process.exit(1)
  }

  const sql = postgres(adminUrl, { ssl: adminUrl.includes('localhost') ? false : 'require', max: 1, prepare: false })

  try {
    for (const gap of GAPS) {
      const exists = await sql<{ n: number }[]>`
        SELECT count(*)::int AS n FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${gap.table} AND column_name = ${gap.column}`
      if (exists[0].n !== 1) {
        console.error(
          `[apply-round59-rls-geometry-gap-closure] Refusing to proceed: column ${gap.column} not found on ${gap.table} in target — expectation mismatch, investigate before retrying.`,
        )
        process.exit(1)
      }

      console.log(`[apply-round59-rls-geometry-gap-closure] Applying RLS geometry for ${gap.table} (column=${gap.column})...`)
      await sql`SELECT ue_create_direct_org_rls_policy(${gap.table}, ${gap.column}, ${gap.isText})`

      const catalog = await sql<{ relrowsecurity: boolean; relforcerowsecurity: boolean }[]>`
        SELECT c.relrowsecurity, c.relforcerowsecurity FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = ${gap.table}`
      const row = catalog[0]
      if (!row?.relrowsecurity || !row?.relforcerowsecurity) {
        console.error(`[apply-round59-rls-geometry-gap-closure] Post-apply check failed: RLS/FORCE RLS not both enabled on ${gap.table}.`)
        process.exit(1)
      }

      const systemPolicy = await sql<{ n: number }[]>`
        SELECT count(*)::int AS n FROM pg_policy p
        JOIN pg_class c ON c.oid = p.polrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = ${gap.table}
          AND p.polroles::regrole[]::text[] @> ARRAY['union_eyes_system']
          AND p.polcmd = '*'`
      if (systemPolicy[0].n < 1) {
        console.error(`[apply-round59-rls-geometry-gap-closure] Post-apply check failed: no unconditional union_eyes_system ALL policy on ${gap.table}.`)
        process.exit(1)
      }

      console.log(`[apply-round59-rls-geometry-gap-closure] ${gap.table}: RLS=t FORCE=t system-ALL-policy=present — ok`)
    }

    console.log('[apply-round59-rls-geometry-gap-closure] All gap tables in the GAPS list closed and verified (strike_fund_disbursements intentionally excluded — see header).')
  } finally {
    await sql.end({ timeout: 2 })
  }
}

main().catch((err) => {
  console.error('[apply-round59-rls-geometry-gap-closure] Unhandled error:', err?.message ?? err)
  process.exit(1)
})
