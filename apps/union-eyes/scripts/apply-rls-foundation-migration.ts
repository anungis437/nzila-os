#!/usr/bin/env tsx
/**
 * apply-rls-foundation-migration.ts — the deterministic, least-privilege
 * idempotent apply step for db/migrations/0108_rls_tenant_isolation_foundation.sql.
 *
 * This exists because the RLS foundation blocker this remediation fixes was
 * itself caused by a migration/deployment-governance gap: security SQL
 * existed in git but nothing in the deployment pipeline ever applied it, so
 * "the migration is in git" never meant "the migration is in the deployed
 * database" (see docs/union-eyes/reality-remediation/26, layer C). This
 * script is the fix for THAT specific gap for migration 0108 — it replaces
 * "a human remembers to run psql ... < 0108.sql" with a scripted, auditable,
 * idempotent, version-controlled apply path that a CI job (or an operator)
 * can invoke deterministically.
 *
 * PRODUCTION RUN 34790263534 (P4 failed-rollout state assessment,
 * 2026-09-13) proved this script's PRIOR design was unsafe to re-run: it
 * always executed 0108's SQL body — including its unconditional
 * `ALTER ROLE union_eyes_runtime/union_eyes_system ...` branches for
 * already-existing roles — before ever checking whether anything actually
 * needed to change. PostgreSQL 16 restricts a non-superuser CREATEROLE role
 * from touching the SUPERUSER/CREATEDB/CREATEROLE/REPLICATION/BYPASSRLS
 * attributes of ANY role (even to redundantly reassert an already-correct
 * value) unless it itself possesses that same attribute — the production
 * migration credential does not, so the reapply failed with "permission
 * denied to alter role" even though nothing was actually wrong. The correct
 * fix is NOT to grant the migration credential broader authority over the
 * runtime/system roles — it is to never issue that ALTER ROLE at all once
 * the foundation is already correctly established.
 *
 * Lifecycle, in order:
 *   1. Connects using ADMIN/migration authority (never the application's
 *      own runtime credential).
 *   2. Performs a complete, read-only attestation of the current foundation
 *      state (roles, immutable attributes, helper functions, RLS/FORCE RLS,
 *      policy geometry, and grants) across the full 0108-protected surface.
 *   3. Classifies the result into exactly one of three states:
 *        - NOT_APPLIED        — both roles are absent. Applies 0108
 *          verbatim (this is the only branch that ever executes the
 *          migration SQL or issues CREATE ROLE/ALTER ROLE), then re-attests
 *          to confirm the apply produced a complete, correct foundation.
 *        - ALREADY_APPLIED    — both roles exist and every check passes.
 *          No SQL is executed at all — not the 0108 migration body, not
 *          CREATE ROLE, not ALTER ROLE. Logged as ALREADY_APPLIED_VERIFIED,
 *          distinct from APPLIED.
 *        - PARTIAL_OR_DRIFTED — only one role exists, or any required
 *          artifact is missing/incorrect. Fails closed: never executes
 *          0108, never attempts CREATE ROLE or ALTER ROLE to self-heal the
 *          mismatch. Returns a precise mismatch summary and exits
 *          non-zero. Existing-role drift is a separate remediation
 *          problem, not something this script (or a broader migration-
 *          admin grant) should paper over.
 *
 * LOGIN capability is intentionally NOT part of the immutable-attribute
 * check: 0108 creates the roles NOLOGIN, and scripts/provision-runtime-db-roles.ts
 * later flips them to LOGIN — both states are legitimate depending on where
 * an environment is in its rollout. Pass --expect-pre-provisioning to
 * additionally assert NOLOGIN specifically (useful for a first-time
 * rollout or to confirm an environment has not yet been provisioned).
 *
 * It does NOT provision LOGIN credentials or touch Key Vault — that is
 * scripts/provision-runtime-db-roles.ts, run as the next step in the
 * rollout sequence (see the fix PR description for the full order).
 *
 * Required env: RLS_MIGRATION_ADMIN_DATABASE_URL (or ADMIN_DATABASE_URL).
 * Never prints the connection string.
 */
import postgres from 'postgres'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import {
  ALL_0108_PROTECTED_TABLES,
  PROTECTED_DIRECT_TABLES,
  PROTECTED_NO_TENANT_ACCESS_TABLES,
} from '../db/rls-0108-protected-tables'

const MIGRATION_PATH = resolve(__dirname, '../db/migrations/0108_rls_tenant_isolation_foundation.sql')
const EXPECTED_ROLES = ['union_eyes_runtime', 'union_eyes_system'] as const
const HELPER_FUNCTIONS = ['ue_create_direct_org_rls_policy', 'ue_create_parent_owned_rls_policy'] as const

// Tables using the 5-policy per-command direct pattern: the 18 direct-org
// tables plus grievance_deadlines, which is parent-owned via grievances.id
// but uses the same per-command bespoke policy shape (0108 PART 6b).
const FIVE_POLICY_TABLES: readonly string[] = [...PROTECTED_DIRECT_TABLES, 'grievance_deadlines']

// Tables using the generic 2-policy (single ALL-command) parent-owned
// pattern (0108 PART 6, PART 6c).
const TWO_POLICY_PARENT_TABLES: readonly string[] = [
  'messages',
  'message_participants',
  'message_read_receipts',
  'message_notifications',
]

// System-only tables: exactly one policy, no runtime access at all (0108 PART 7).
const SYSTEM_ONLY_TABLES: readonly string[] = [...PROTECTED_NO_TENANT_ACCESS_TABLES]

interface RoleAttributes {
  rolname: string
  rolcanlogin: boolean
  rolsuper: boolean
  rolbypassrls: boolean
  rolcreatedb: boolean
  rolcreaterole: boolean
  rolreplication: boolean
  rolinherit: boolean
}

interface PolicyRow {
  tablename: string
  policyname: string
  cmd: string
  roles: string[]
  qual: string | null
  with_check: string | null
}

type FoundationState = 'NOT_APPLIED' | 'ALREADY_APPLIED' | 'PARTIAL_OR_DRIFTED'

interface FoundationAttestation {
  state: FoundationState
  mismatches: string[]
}

function checkImmutableAttributes(role: RoleAttributes, expectPreProvisioning: boolean): string[] {
  const bad: string[] = []
  if (role.rolsuper) bad.push(`${role.rolname}: rolsuper=true (expected false)`)
  if (role.rolbypassrls) bad.push(`${role.rolname}: rolbypassrls=true (expected false)`)
  if (role.rolcreatedb) bad.push(`${role.rolname}: rolcreatedb=true (expected false)`)
  if (role.rolcreaterole) bad.push(`${role.rolname}: rolcreaterole=true (expected false)`)
  if (role.rolreplication) bad.push(`${role.rolname}: rolreplication=true (expected false)`)
  if (!role.rolinherit) bad.push(`${role.rolname}: rolinherit=false (expected true)`)
  // rolcanlogin is lifecycle-dependent — only asserted under --expect-pre-provisioning.
  if (expectPreProvisioning && role.rolcanlogin) {
    bad.push(`${role.rolname}: rolcanlogin=true (--expect-pre-provisioning asserts NOLOGIN at this stage)`)
  }
  return bad
}

function expectRuntimeCommandPolicy(
  mismatches: string[],
  table: string,
  policies: PolicyRow[],
  name: string,
  cmd: string,
  requireQual: boolean,
  requireWithCheck: boolean,
): void {
  const p = policies.find((x) => x.policyname === name)
  if (!p) {
    mismatches.push(`${table}: missing policy ${name}`)
    return
  }
  if (p.cmd !== cmd) mismatches.push(`${table}.${name}: cmd=${p.cmd}, expected ${cmd}`)
  if (!p.roles.includes('union_eyes_runtime')) mismatches.push(`${table}.${name}: not scoped to union_eyes_runtime`)
  if (requireQual && !p.qual) mismatches.push(`${table}.${name}: missing USING expression`)
  if (requireWithCheck && !p.with_check) mismatches.push(`${table}.${name}: missing WITH CHECK expression`)
}

function expectSystemFullAccess(mismatches: string[], table: string, policies: PolicyRow[]): void {
  const p = policies.find((x) => x.policyname === 'ue_system_full_access')
  if (!p) {
    mismatches.push(`${table}: missing policy ue_system_full_access`)
    return
  }
  if (p.cmd !== 'ALL') mismatches.push(`${table}.ue_system_full_access: cmd=${p.cmd}, expected ALL`)
  if (!p.roles.includes('union_eyes_system')) mismatches.push(`${table}.ue_system_full_access: not scoped to union_eyes_system`)
  if (!p.qual) mismatches.push(`${table}.ue_system_full_access: missing USING expression`)
  if (!p.with_check) mismatches.push(`${table}.ue_system_full_access: missing WITH CHECK expression`)
}

/**
 * Read-only. Never issues DDL. Classifies the current database state so the
 * caller can decide whether 0108 needs to run at all.
 */
async function attestFoundationState(sql: postgres.Sql, expectPreProvisioning: boolean): Promise<FoundationAttestation> {
  const roleRows = await sql<RoleAttributes[]>`
    SELECT rolname, rolcanlogin, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolreplication, rolinherit
    FROM pg_roles WHERE rolname = ANY(${EXPECTED_ROLES as unknown as string[]})`
  const roles = new Map(roleRows.map((r) => [r.rolname, r]))
  const present = EXPECTED_ROLES.filter((r) => roles.has(r))

  if (present.length === 0) {
    return { state: 'NOT_APPLIED', mismatches: [] }
  }
  if (present.length === 1) {
    const missing = EXPECTED_ROLES.find((r) => !roles.has(r))
    return {
      state: 'PARTIAL_OR_DRIFTED',
      mismatches: [`Only role ${present[0]} exists; ${missing} is missing. Expected both roles or neither.`],
    }
  }

  const mismatches: string[] = []

  for (const roleName of EXPECTED_ROLES) {
    const role = roles.get(roleName)
    if (!role) continue
    mismatches.push(...checkImmutableAttributes(role, expectPreProvisioning))
  }

  const helperRows = await sql<{ proname: string }[]>`
    SELECT proname FROM pg_proc WHERE proname = ANY(${HELPER_FUNCTIONS as unknown as string[]})`
  const helperNames = new Set(helperRows.map((r) => r.proname))
  for (const fn of HELPER_FUNCTIONS) {
    if (!helperNames.has(fn)) mismatches.push(`Missing helper function: ${fn}`)
  }

  const rlsRows = await sql<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }[]>`
    SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = ANY(${ALL_0108_PROTECTED_TABLES as unknown as string[]})`
  const rlsByTable = new Map(rlsRows.map((r) => [r.relname, r]))
  for (const table of ALL_0108_PROTECTED_TABLES) {
    const row = rlsByTable.get(table)
    if (!row) {
      mismatches.push(`${table}: table missing entirely`)
      continue
    }
    if (!row.relrowsecurity) mismatches.push(`${table}: RLS not enabled`)
    if (!row.relforcerowsecurity) mismatches.push(`${table}: FORCE RLS not enabled`)
  }

  const policyRows = await sql<PolicyRow[]>`
    SELECT tablename, policyname, cmd, roles, qual, with_check
    FROM pg_policies WHERE schemaname = 'public' AND tablename = ANY(${ALL_0108_PROTECTED_TABLES as unknown as string[]})`
  const policiesByTable = new Map<string, PolicyRow[]>()
  for (const row of policyRows) {
    const list = policiesByTable.get(row.tablename) ?? []
    list.push(row)
    policiesByTable.set(row.tablename, list)
  }

  for (const table of FIVE_POLICY_TABLES) {
    const policies = policiesByTable.get(table) ?? []
    if (policies.length !== 5) mismatches.push(`${table}: expected exactly 5 policies, found ${policies.length}`)
    expectRuntimeCommandPolicy(mismatches, table, policies, 'ue_org_isolation_select', 'SELECT', true, false)
    expectRuntimeCommandPolicy(mismatches, table, policies, 'ue_org_isolation_insert', 'INSERT', false, true)
    expectRuntimeCommandPolicy(mismatches, table, policies, 'ue_org_isolation_update', 'UPDATE', true, true)
    expectRuntimeCommandPolicy(mismatches, table, policies, 'ue_org_isolation_delete', 'DELETE', true, false)
    expectSystemFullAccess(mismatches, table, policies)
  }

  for (const table of TWO_POLICY_PARENT_TABLES) {
    const policies = policiesByTable.get(table) ?? []
    if (policies.length !== 2) mismatches.push(`${table}: expected exactly 2 policies, found ${policies.length}`)
    expectRuntimeCommandPolicy(mismatches, table, policies, 'ue_parent_org_isolation', 'ALL', true, true)
    expectSystemFullAccess(mismatches, table, policies)
  }

  for (const table of SYSTEM_ONLY_TABLES) {
    const policies = policiesByTable.get(table) ?? []
    if (policies.length !== 1) mismatches.push(`${table}: expected exactly 1 policy (system-only), found ${policies.length}`)
    expectSystemFullAccess(mismatches, table, policies)
  }

  for (const role of EXPECTED_ROLES) {
    const [schemaUsage] = await sql<{ has: boolean }[]>`SELECT has_schema_privilege(${role}, 'public', 'USAGE') AS has`
    if (!schemaUsage.has) mismatches.push(`${role}: missing USAGE on schema public`)

    const [dbConnect] = await sql<{ has: boolean }[]>`SELECT has_database_privilege(${role}, current_database(), 'CONNECT') AS has`
    if (!dbConnect.has) mismatches.push(`${role}: missing CONNECT on database`)

    const tableGrants = await sql<{ tablename: string; sel: boolean; ins: boolean; upd: boolean; del: boolean }[]>`
      SELECT
        t.tablename,
        has_table_privilege(${role}, quote_ident(t.tablename)::regclass, 'SELECT') AS sel,
        has_table_privilege(${role}, quote_ident(t.tablename)::regclass, 'INSERT') AS ins,
        has_table_privilege(${role}, quote_ident(t.tablename)::regclass, 'UPDATE') AS upd,
        has_table_privilege(${role}, quote_ident(t.tablename)::regclass, 'DELETE') AS del
      FROM pg_tables t WHERE t.schemaname = 'public'`
    for (const row of tableGrants) {
      if (!(row.sel && row.ins && row.upd && row.del)) {
        mismatches.push(`${role}: missing full DML grant on table ${row.tablename}`)
      }
    }

    const sequenceGrants = await sql<{ sequencename: string; usg: boolean; sel: boolean }[]>`
      SELECT
        s.sequencename,
        has_sequence_privilege(${role}, quote_ident(s.sequencename)::regclass, 'USAGE') AS usg,
        has_sequence_privilege(${role}, quote_ident(s.sequencename)::regclass, 'SELECT') AS sel
      FROM pg_sequences s WHERE s.schemaname = 'public'`
    for (const row of sequenceGrants) {
      if (!(row.usg && row.sel)) {
        mismatches.push(`${role}: missing USAGE/SELECT grant on sequence ${row.sequencename}`)
      }
    }
  }

  const defaultAclRows = await sql<{ acl: string | null }[]>`SELECT defaclacl::text AS acl FROM pg_default_acl`
  for (const row of defaultAclRows) {
    if (row.acl && EXPECTED_ROLES.some((role) => row.acl!.includes(role))) {
      mismatches.push(`Forbidden sticky default-ACL grant found referencing a runtime/system role: ${row.acl}`)
    }
  }

  return { state: mismatches.length === 0 ? 'ALREADY_APPLIED' : 'PARTIAL_OR_DRIFTED', mismatches }
}

async function main() {
  const expectPreProvisioning = process.argv.includes('--expect-pre-provisioning')
  const adminUrl = process.env.RLS_MIGRATION_ADMIN_DATABASE_URL || process.env.ADMIN_DATABASE_URL
  if (!adminUrl) {
    console.error('[apply-rls-foundation-migration] Missing RLS_MIGRATION_ADMIN_DATABASE_URL / ADMIN_DATABASE_URL.')
    process.exit(1)
  }

  const sql = postgres(adminUrl, { ssl: adminUrl.includes('localhost') ? false : 'require', max: 1, prepare: false })

  try {
    const attestation = await attestFoundationState(sql, expectPreProvisioning)

    if (attestation.state === 'ALREADY_APPLIED') {
      console.log(
        '[apply-rls-foundation-migration] ALREADY_APPLIED_VERIFIED: the complete 0108 foundation (roles, immutable attributes, helper functions, RLS/FORCE RLS, policy geometry, grants) is already correctly established. 0108 SQL was NOT executed; no CREATE ROLE or ALTER ROLE was issued.',
      )
      return
    }

    if (attestation.state === 'PARTIAL_OR_DRIFTED') {
      console.error(
        '[apply-rls-foundation-migration] FAIL (PARTIAL_OR_DRIFTED): existing runtime/system role state does not match the expected complete 0108 foundation. Failing closed — this script will NOT execute 0108, issue CREATE ROLE, or issue ALTER ROLE to self-heal the mismatch. The migration credential is intentionally not granted broader authority over these roles; resolve the drift via a dedicated remediation.',
      )
      for (const m of attestation.mismatches) console.error(`  - ${m}`)
      process.exit(1)
    }

    // NOT_APPLIED — both roles are absent. First-time apply.
    const migrationSql = readFileSync(MIGRATION_PATH, 'utf8')
    const migrationHash = createHash('sha256').update(migrationSql).digest('hex')
    console.log(`[apply-rls-foundation-migration] FOUNDATION_STATE=NOT_APPLIED. Applying ${MIGRATION_PATH}`)
    console.log(`[apply-rls-foundation-migration] SHA-256: ${migrationHash}`)

    await sql.unsafe(migrationSql)
    console.log('[apply-rls-foundation-migration] APPLIED: migration executed without error.')

    const postApply = await attestFoundationState(sql, expectPreProvisioning)
    if (postApply.state !== 'ALREADY_APPLIED') {
      console.error('[apply-rls-foundation-migration] FAIL: post-apply verification did not confirm a complete foundation state.')
      for (const m of postApply.mismatches) console.error(`  - ${m}`)
      process.exit(1)
    }

    console.log(
      '[apply-rls-foundation-migration] Migration + full foundation verification complete. Next: scripts/provision-runtime-db-roles.ts (if not already run for this environment).',
    )
  } finally {
    await sql.end({ timeout: 2 })
  }
}

main().catch((err) => {
  console.error('[apply-rls-foundation-migration] Failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
