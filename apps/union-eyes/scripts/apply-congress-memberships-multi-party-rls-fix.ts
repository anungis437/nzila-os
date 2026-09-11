#!/usr/bin/env tsx
/**
 * apply-congress-memberships-multi-party-rls-fix.ts — Release Gate E.1/E.2
 * corrective RLS policy for congress_memberships.
 *
 * ROOT CAUSE: db/rls-storage-authority/governance.ts classified
 * congress_memberships as TENANT_RLS_REQUIRED (round 59D), which requires
 * single-column direct-org geometry to auto-derive a policy. The table's
 * actual schema (db/schema/domains/data/congress.ts) has TWO org-typed FK
 * columns to `organizations` — organization_id (member org) and
 * congress_id (congress-level org) — confirmed via
 * reports/union-eyes-rls-geometry.json (confidence=CANDIDATE_MULTI_PARTY).
 * The enforcement-migration generator correctly refused to guess a
 * single-column policy and blocked (UNRESOLVED_DIRECT_ORG_GEOMETRY) rather
 * than silently emit one — reclassified to MULTI_PARTY_RLS_REQUIRED
 * (Gate E.1), matching the same classification per_capita_remittances
 * already uses for its own two-party geometry.
 *
 * The committed enforcement migration
 * (db/migrations/20260910_rls_enforcement_expansion_round58.sql) was
 * regenerated in place to include this table's policy (this repo's
 * established generated-artifact convention), but that migration file was
 * already applied to staging as a one-time rollout before this correction
 * existed — the established convention for correcting an already-migrated
 * environment is a new, narrow, forward-only apply script (see
 * apply-round58-grant-order-fix.ts, apply-round59-congress-memberships-
 * grant-fix.ts, apply-round59-rls-geometry-gap-closure.ts), never a
 * re-application of the whole historical migration file.
 *
 * This script re-invokes the already-defined, already-proven
 * `ue_create_multi_party_rls_policy(table, orgColumnA, orgColumnB)`
 * Postgres function (created via the original round58 migration, already
 * live in staging via per_capita_remittances' own use of it — never
 * dropped) directly for congress_memberships, and re-asserts the SELECT
 * grant applied in round 59D (idempotent — a no-op if already present).
 *
 * The function itself creates a SELECT-only policy (current_org_id matches
 * EITHER organization_id OR congress_id) and no tenant write policy —
 * matching congress_memberships' requiredRuntimePrivileges=["SELECT"].
 *
 * Required env: RLS_ENFORCEMENT_ADMIN_DATABASE_URL (or ADMIN_DATABASE_URL).
 * Never prints the connection string.
 */
import postgres from 'postgres'

async function main() {
  const adminUrl = process.env.RLS_ENFORCEMENT_ADMIN_DATABASE_URL || process.env.ADMIN_DATABASE_URL
  if (!adminUrl) {
    console.error('[apply-congress-memberships-multi-party-rls-fix] Missing RLS_ENFORCEMENT_ADMIN_DATABASE_URL / ADMIN_DATABASE_URL.')
    process.exit(1)
  }

  const sql = postgres(adminUrl, { ssl: adminUrl.includes('localhost') ? false : 'require', max: 1, prepare: false })

  try {
    const exists = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'congress_memberships'`
    if (exists[0].n === 0) {
      console.log('[apply-congress-memberships-multi-party-rls-fix] congress_memberships does not exist on this database — nothing to do.')
      return
    }

    const fn = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM pg_proc WHERE proname = 'ue_create_multi_party_rls_policy'`
    if (fn[0].n === 0) {
      console.error('[apply-congress-memberships-multi-party-rls-fix] ue_create_multi_party_rls_policy() does not exist on this database — the round58 migration must be applied first.')
      process.exit(1)
    }

    await sql.unsafe(`SELECT ue_create_multi_party_rls_policy('congress_memberships', 'organization_id', 'congress_id')`)
    console.log('[apply-congress-memberships-multi-party-rls-fix] ue_create_multi_party_rls_policy applied to congress_memberships.')

    await sql.unsafe('GRANT SELECT ON TABLE congress_memberships TO union_eyes_runtime')
    console.log('[apply-congress-memberships-multi-party-rls-fix] GRANT SELECT ON congress_memberships TO union_eyes_runtime re-asserted (idempotent).')

    const rls = await sql<{ relrowsecurity: boolean; relforcerowsecurity: boolean }[]>`
      SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'congress_memberships' AND relnamespace = 'public'::regnamespace`
    if (rls.length === 0 || !rls[0].relrowsecurity || !rls[0].relforcerowsecurity) {
      console.error('[apply-congress-memberships-multi-party-rls-fix] Post-apply check failed: RLS not enabled/forced on congress_memberships.')
      process.exit(1)
    }
    console.log('[apply-congress-memberships-multi-party-rls-fix] Verified: RLS enabled + forced on congress_memberships.')

    const policies = await sql<{ policyname: string; cmd: string; qual: string | null }[]>`
      SELECT policyname, cmd, qual FROM pg_policies WHERE schemaname = 'public' AND tablename = 'congress_memberships'`
    const select = policies.find((p) => p.policyname === 'ue_multi_party_select')
    if (!select || select.cmd !== 'SELECT' || !select.qual?.includes('organization_id') || !select.qual?.includes('congress_id')) {
      console.error('[apply-congress-memberships-multi-party-rls-fix] Post-apply check failed: ue_multi_party_select policy missing or geometry mismatch.')
      console.error(JSON.stringify(policies))
      process.exit(1)
    }
    console.log('[apply-congress-memberships-multi-party-rls-fix] Verified: ue_multi_party_select policy present, geometry = organization_id OR congress_id.')

    const writePolicies = policies.filter((p) => p.policyname !== 'ue_multi_party_select' && p.policyname !== 'ue_system_full_access')
    if (writePolicies.length > 0) {
      console.error(`[apply-congress-memberships-multi-party-rls-fix] Post-apply check failed: unexpected extra polic(y/ies): ${writePolicies.map((p) => p.policyname).join(', ')}`)
      process.exit(1)
    }
    console.log('[apply-congress-memberships-multi-party-rls-fix] Confirmed: no tenant write policy exists — SELECT only, matching manifest.')

    const grants = await sql<{ privilege_type: string }[]>`
      SELECT privilege_type FROM information_schema.role_table_grants
      WHERE grantee = 'union_eyes_runtime' AND table_schema = 'public' AND table_name = 'congress_memberships'`
    const privs = grants.map((g) => g.privilege_type)
    if (!privs.includes('SELECT') || privs.some((p) => p !== 'SELECT')) {
      console.error(`[apply-congress-memberships-multi-party-rls-fix] Post-apply check failed: unexpected grant set: ${JSON.stringify(privs)}`)
      process.exit(1)
    }
    console.log('[apply-congress-memberships-multi-party-rls-fix] Confirmed: union_eyes_runtime has SELECT only on congress_memberships.')

    const publicGrants = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM information_schema.role_table_grants
      WHERE grantee = 'PUBLIC' AND table_schema = 'public' AND table_name = 'congress_memberships'`
    if (publicGrants[0].n > 0) {
      console.error('[apply-congress-memberships-multi-party-rls-fix] Post-apply check failed: PUBLIC has grants on congress_memberships.')
      process.exit(1)
    }
    console.log('[apply-congress-memberships-multi-party-rls-fix] Confirmed: no PUBLIC grants on congress_memberships.')
  } finally {
    await sql.end({ timeout: 2 })
  }
}

main().catch((err) => {
  console.error('[apply-congress-memberships-multi-party-rls-fix] Unhandled error:', err?.message ?? err)
  process.exit(1)
})
