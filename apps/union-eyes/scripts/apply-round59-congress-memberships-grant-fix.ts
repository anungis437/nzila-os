#!/usr/bin/env tsx
/**
 * apply-round59-congress-memberships-grant-fix.ts — Round 59D corrective
 * grant for congress_memberships.
 *
 * ROOT CAUSE: db/rls-storage-authority/governance.ts previously classified
 * congress_memberships as LATENT_UNREACHABLE (requiredRuntimePrivileges: []),
 * on the basis that its sole known caller (lib/auth/hierarchy-access-
 * control.ts) had zero real callers. That was true but incomplete — it
 * predates lib/clause-library/sharing-authority.ts's isOrgCongressEligible()/
 * buildClauseVisibilityCondition(), which DO query this table via the plain
 * tenant `db` client and ARE wired into live shared-clause-library routes
 * (closed round 55). Because the manifest fed the round58 enforcement
 * migration's GRANT compiler, union_eyes_runtime ended up with a hard
 * REVOKE ALL on this table — any congress-affiliated caller attempting a
 * congress-level shared-clause visibility check hits a raw Postgres
 * "permission denied for table congress_memberships" error instead of a
 * graceful authorization result.
 *
 * Live proof this round: apps/union-eyes/lib/clause-library/__tests__/
 * round59d-adhoc-staging-proof.test.ts (run directly against staging, not
 * committed) reproduced the exact permission-denied failure before this
 * fix, and passed cleanly after it.
 *
 * FIX: this is a narrow, single-table, single-privilege corrective grant,
 * applied the same way apply-round58-grant-order-fix.ts applies its
 * correction — as a new, separate, atomic apply, never by hand-editing the
 * already-shipped 20260910_rls_enforcement_expansion_round58.sql migration.
 * Only SELECT is granted, matching the read-only shape of every real query
 * against this table in the caller (isOrgCongressEligible only ever reads).
 *
 * Required env: RLS_ENFORCEMENT_ADMIN_DATABASE_URL (or ADMIN_DATABASE_URL).
 * Never prints the connection string.
 */
import postgres from 'postgres'

async function main() {
  const adminUrl = process.env.RLS_ENFORCEMENT_ADMIN_DATABASE_URL || process.env.ADMIN_DATABASE_URL
  if (!adminUrl) {
    console.error('[apply-round59-congress-memberships-grant-fix] Missing RLS_ENFORCEMENT_ADMIN_DATABASE_URL / ADMIN_DATABASE_URL.')
    process.exit(1)
  }

  const sql = postgres(adminUrl, { ssl: adminUrl.includes('localhost') ? false : 'require', max: 1, prepare: false })

  try {
    const exists = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'congress_memberships'`
    if (exists[0].n === 0) {
      console.log('[apply-round59-congress-memberships-grant-fix] congress_memberships does not exist on this database — nothing to do.')
      return
    }

    await sql.unsafe('GRANT SELECT ON TABLE congress_memberships TO union_eyes_runtime')
    console.log('[apply-round59-congress-memberships-grant-fix] GRANT SELECT ON congress_memberships TO union_eyes_runtime applied (idempotent).')

    const grant = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM information_schema.role_table_grants
      WHERE grantee = 'union_eyes_runtime' AND table_schema = 'public' AND table_name = 'congress_memberships' AND privilege_type = 'SELECT'`
    if (grant[0].n === 0) {
      console.error('[apply-round59-congress-memberships-grant-fix] Post-apply check failed: SELECT grant not visible after apply.')
      process.exit(1)
    }
    console.log('[apply-round59-congress-memberships-grant-fix] Verified: union_eyes_runtime has SELECT on congress_memberships.')

    const otherPrivs = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM information_schema.role_table_grants
      WHERE grantee = 'union_eyes_runtime' AND table_schema = 'public' AND table_name = 'congress_memberships' AND privilege_type != 'SELECT'`
    if (otherPrivs[0].n > 0) {
      console.error(`[apply-round59-congress-memberships-grant-fix] Post-apply check failed: ${otherPrivs[0].n} non-SELECT privilege(s) unexpectedly present.`)
      process.exit(1)
    }
    console.log('[apply-round59-congress-memberships-grant-fix] Confirmed: no INSERT/UPDATE/DELETE granted — SELECT only, matching manifest.')
  } finally {
    await sql.end({ timeout: 2 })
  }
}

main().catch((err) => {
  console.error('[apply-round59-congress-memberships-grant-fix] Unhandled error:', err?.message ?? err)
  process.exit(1)
})
