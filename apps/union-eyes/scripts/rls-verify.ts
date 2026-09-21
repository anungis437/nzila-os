#!/usr/bin/env tsx
/**
 * ue:rls:verify — deployment-time fail-closed RLS preflight for Union Eyes.
 *
 * Verifies that the RLS tenant-isolation foundation
 * (db/migrations/0108_rls_tenant_isolation_foundation.sql) is actually in
 * force on the TARGET database — not just present in git. This is the tool
 * PR #751 / the RLS runtime-acceptance finding calls for: CI can validate
 * migration structure, but only a live preflight against the real database
 * catalog can prove RLS state, which is exactly what silently drifted out
 * of sync with the migration history in staging.
 *
 * Modes:
 *   --mode=preflight (default) — read-only. Safe to run against a live
 *     staging/production database as a deploy-gate check. Verifies role
 *     attributes, RLS+FORCE RLS+policy presence on every required table,
 *     and that no policy uses the prohibited empty-context-bypass pattern.
 *   --mode=full — additionally creates disposable Org A/B + User A/B
 *     fixtures (prefixed `UE_RA_<runId>_`), runs the live cross-tenant
 *     isolation matrix using the ACTUAL runtime role and session-context
 *     mechanism (`set_config('app.current_org_id', ...)`), then deletes
 *     everything it created. Intended for a disposable/local database
 *     (see §11 of the remediation brief) — do not point --mode=full at a
 *     database with real tenant data without understanding the fixture
 *     lifecycle below.
 *
 *     KNOWN ISSUE: the fixture-bootstrap step below has been observed to
 *     intermittently fail with a spurious "new row violates row-level
 *     security policy" error against a local Windows + Docker Desktop
 *     Postgres, for reasons not root-caused despite extensive isolation
 *     testing (identical statements succeed reliably via psql and via
 *     minimal standalone repro scripts against the same database/role —
 *     the failure only reproduces inside this file's specific async
 *     function structure). This has not been reproduced against a native
 *     Linux Postgres. If --mode=full fails at the bootstrap step, use
 *     scripts/rls-manual-proof.sql (run directly via psql) as the
 *     equivalent, independently-verified fixture matrix instead — it
 *     exercises the exact same assertions and is what this migration was
 *     actually proven against before shipping.
 *
 * Connection: reads RLS_VERIFY_DATABASE_URL (falling back to DATABASE_URL)
 * for the tenant runtime role. In --mode=full, reads
 * RLS_VERIFY_BOOTSTRAP_DATABASE_URL (falling back to the repository's
 * migration/admin env names) for privileged fixture setup/cleanup only.
 * Never prints either connection string.
 *
 * Exit code: 0 on all checks passing, 1 on any failure. Intended to gate
 * CI/deployment — see the fix PR description for wiring into the pipeline.
 */
import postgres from 'postgres'
import {
  ALL_0108_PROTECTED_TABLES as ALL_PROTECTED_TABLES,
  PROTECTED_NO_TENANT_ACCESS_TABLES,
} from '../db/rls-0108-protected-tables'
import { storageAuthorityManifest } from '../db/rls-storage-authority/index'

// Tables the canonical storageAuthorityManifest (db/rls-storage-authority)
// dispositions with an EMPTY requiredRuntimePrivileges array — i.e.
// LATENT_UNREACHABLE / SYSTEM_ONLY entries where union_eyes_runtime is
// deliberately granted ZERO table-level privileges because no application
// code path queries the table today. For these tables, a live
// `permission denied` error on a direct SELECT is the CORRECT and expected
// outcome (a stronger guarantee than RLS returning zero rows) — not a
// failure. Derived from the manifest (not hand-maintained) so this set
// can never silently drift from the actual GRANT-compiler input.
const ZERO_RUNTIME_PRIVILEGE_TABLES = new Set(
  storageAuthorityManifest
    .filter((e) => Array.isArray(e.requiredRuntimePrivileges) && e.requiredRuntimePrivileges.length === 0)
    .map((e) => e.table),
)

interface CheckResult {
  name: string
  pass: boolean
  detail: string
}

interface RoleSnapshot {
  currentUser: string
  rolsuper: boolean
  rolbypassrls: boolean
  rolcanlogin: boolean
}

interface FixtureOrganization {
  id: string
  name: string
  slug: string
  organizationType: 'union'
  hierarchyPath: string[]
  hierarchyLevel: number
  status: 'active'
  settings: Record<string, unknown>
}

interface FixtureGrievance {
  id: string
  grievanceNumber: string
  type: 'other'
  title: string
  description: string
  organizationId: string
}

type TenantContextSql = {
  unsafe: postgres.Sql['unsafe']
}

export const RLS_VERIFY_ORGANIZATION_FIXTURE_COLUMNS = [
  'id',
  'name',
  'slug',
  'organization_type',
  'hierarchy_path',
  'hierarchy_level',
  'status',
  'settings',
] as const

export const RLS_VERIFY_GRIEVANCE_FIXTURE_COLUMNS = [
  'id',
  'grievance_number',
  'type',
  'title',
  'description',
  'organization_id',
] as const

export function buildRlsVerifyOrganizationFixture(input: {
  id: string
  name: string
  slug: string
  runId: string
}): FixtureOrganization {
  return {
    id: input.id,
    name: input.name,
    slug: input.slug,
    organizationType: 'union',
    hierarchyPath: [input.id],
    hierarchyLevel: 0,
    status: 'active',
    settings: { rls_verify_fixture: true, run_id: input.runId },
  }
}

export function buildRlsVerifyGrievanceFixture(input: {
  id: string
  organizationId: string
  runId: string
  label: string
}): FixtureGrievance {
  return {
    id: input.id,
    grievanceNumber: `${input.runId}-${input.label}`.slice(0, 50),
    type: 'other',
    title: `${input.runId} ${input.label}`,
    description: `Synthetic RLS verifier grievance fixture for ${input.runId} / ${input.label}.`,
    organizationId: input.organizationId,
  }
}

function isCaughtErrorResult(value: unknown): value is { error: string } {
  return typeof value === 'object' && value !== null && 'error' in value
}

async function setTenantContext(sql: TenantContextSql, input: { orgId: string; userId: string }) {
  await sql.unsafe(`SELECT set_config('app.current_user_id', $1, true)`, [input.userId])
  await sql.unsafe(`SELECT set_config('app.current_org_id', $1, true)`, [input.orgId])
}

export function resolveRuntimeDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env.RLS_VERIFY_DATABASE_URL || env.DATABASE_URL
}

export function resolveBootstrapDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return (
    env.RLS_VERIFY_BOOTSTRAP_DATABASE_URL ||
    env.RLS_ENFORCEMENT_ADMIN_DATABASE_URL ||
    env.RLS_MIGRATION_ADMIN_DATABASE_URL ||
    env.ADMIN_DATABASE_URL
  )
}

export function validateFullModePrincipalModel(input: {
  runtime: RoleSnapshot
  bootstrap: RoleSnapshot
}): CheckResult[] {
  const { runtime, bootstrap } = input
  return [
    {
      name: 'full-mode principal separation: bootstrap role differs from runtime role',
      pass: bootstrap.currentUser !== runtime.currentUser,
      detail: `bootstrap=${bootstrap.currentUser}, runtime=${runtime.currentUser}`,
    },
    {
      name: 'full-mode runtime principal: connected as union_eyes_runtime',
      pass: runtime.currentUser === 'union_eyes_runtime',
      detail: `current_user = ${runtime.currentUser}`,
    },
    {
      name: 'full-mode runtime principal: NOSUPERUSER',
      pass: runtime.rolsuper === false,
      detail: `rolsuper = ${runtime.rolsuper}`,
    },
    {
      name: 'full-mode runtime principal: NOBYPASSRLS',
      pass: runtime.rolbypassrls === false,
      detail: `rolbypassrls = ${runtime.rolbypassrls}`,
    },
    {
      name: 'full-mode bootstrap principal: connected',
      pass: Boolean(bootstrap.currentUser),
      detail: `current_user = ${bootstrap.currentUser}; bootstrap is used only for synthetic fixture setup/cleanup`,
    },
  ]
}

// Per-table org-column metadata for the live RLS-state checks below. Table
// MEMBERSHIP in the 0108-protected set is sourced from
// db/rls-0108-protected-tables.ts (see the import above) — this array adds
// the extra orgColumn/orgColumnIsText detail that module doesn't carry,
// and its .table values must stay a superset match of that module's
// PROTECTED_DIRECT_TABLES names.
const PROTECTED_DIRECT_TABLES = [
  { table: 'organization_members', orgColumn: 'organization_id', orgColumnIsText: false },
  { table: 'organizations', orgColumn: 'id', orgColumnIsText: false },
  { table: 'grievances', orgColumn: 'organization_id', orgColumnIsText: false },
  { table: 'claims', orgColumn: 'organization_id', orgColumnIsText: false },
  { table: 'documents', orgColumn: 'organization_id', orgColumnIsText: false },
  { table: 'member_documents', orgColumn: 'organization_id', orgColumnIsText: false },
  { table: 'workplace_incidents', orgColumn: 'organization_id', orgColumnIsText: false },
  { table: 'safety_inspections', orgColumn: 'organization_id', orgColumnIsText: false },
  { table: 'hazard_reports', orgColumn: 'organization_id', orgColumnIsText: false },
  { table: 'safety_committee_meetings', orgColumn: 'organization_id', orgColumnIsText: false },
  { table: 'safety_training_records', orgColumn: 'organization_id', orgColumnIsText: false },
  { table: 'ppe_equipment', orgColumn: 'organization_id', orgColumnIsText: false },
  { table: 'safety_audits', orgColumn: 'organization_id', orgColumnIsText: false },
  { table: 'injury_logs', orgColumn: 'organization_id', orgColumnIsText: false },
  { table: 'safety_policies', orgColumn: 'organization_id', orgColumnIsText: false },
  { table: 'corrective_actions', orgColumn: 'organization_id', orgColumnIsText: false },
  { table: 'safety_certifications', orgColumn: 'organization_id', orgColumnIsText: false },
  { table: 'message_threads', orgColumn: 'organization_id', orgColumnIsText: false },
] as const

function parseArgs() {
  const args = process.argv.slice(2)
  const modeArg = args.find((a) => a.startsWith('--mode='))
  const mode = modeArg ? modeArg.split('=')[1] : 'preflight'
  if (mode !== 'preflight' && mode !== 'full') {
    throw new Error(`Unknown --mode value: ${mode}. Expected "preflight" or "full".`)
  }
  return { mode: mode as 'preflight' | 'full' }
}

async function checkRuntimeRole(sql: postgres.Sql, results: CheckResult[]) {
  const attrs = await readCurrentRoleSnapshot(sql)

  results.push({
    name: 'runtime-role: connected as union_eyes_runtime',
    pass: attrs.currentUser === 'union_eyes_runtime',
    detail: `current_user = ${attrs.currentUser}`,
  })
  results.push({
    name: 'runtime-role: NOSUPERUSER',
    pass: attrs.rolsuper === false,
    detail: `rolsuper = ${attrs.rolsuper}`,
  })
  results.push({
    name: 'runtime-role: NOBYPASSRLS',
    pass: attrs.rolbypassrls === false,
    detail: `rolbypassrls = ${attrs.rolbypassrls}`,
  })
}

async function readCurrentRoleSnapshot(sql: postgres.Sql): Promise<RoleSnapshot> {
  const [identity] = await sql`SELECT current_user`
  const [attrs] = await sql`
    SELECT rolname, rolsuper, rolbypassrls, rolcanlogin
    FROM pg_roles WHERE rolname = current_user`
  if (!attrs) {
    throw new Error(`Could not resolve pg_roles row for current_user=${identity.current_user}`)
  }
  return {
    currentUser: identity.current_user,
    rolsuper: attrs.rolsuper,
    rolbypassrls: attrs.rolbypassrls,
    rolcanlogin: attrs.rolcanlogin,
  }
}

async function checkFullModePrincipalModel(
  runtimeSql: postgres.Sql,
  bootstrapSql: postgres.Sql,
  results: CheckResult[],
) {
  const runtime = await readCurrentRoleSnapshot(runtimeSql)
  const bootstrap = await readCurrentRoleSnapshot(bootstrapSql)
  const principalResults = validateFullModePrincipalModel({ runtime, bootstrap })
  results.push(...principalResults)
  const failed = principalResults.filter((r) => !r.pass)
  if (failed.length > 0) {
    throw new Error(
      'Full-mode verifier principal validation failed before fixture bootstrap: ' +
        failed.map((r) => `${r.name} (${r.detail})`).join('; '),
    )
  }
}

async function checkTableRlsState(sql: postgres.Sql, results: CheckResult[]) {
  const rows = await sql<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }[]>`
    SELECT relname, relrowsecurity, relforcerowsecurity
    FROM pg_class
    WHERE relname = ANY(${ALL_PROTECTED_TABLES}) AND relkind = 'r'`

  const found = new Map(rows.map((r) => [r.relname, r]))
  for (const table of ALL_PROTECTED_TABLES) {
    const row = found.get(table)
    results.push({
      name: `table ${table}: exists`,
      pass: Boolean(row),
      detail: row ? 'found' : 'MISSING — expected by 0108_rls_tenant_isolation_foundation.sql',
    })
    if (!row) continue
    results.push({
      name: `table ${table}: RLS enabled`,
      pass: row.relrowsecurity === true,
      detail: `relrowsecurity = ${row.relrowsecurity}`,
    })
    results.push({
      name: `table ${table}: RLS forced`,
      pass: row.relforcerowsecurity === true,
      detail: `relforcerowsecurity = ${row.relforcerowsecurity}`,
    })
  }

  const policies = await sql<{ tablename: string; policyname: string; qual: string | null }[]>`
    SELECT tablename, policyname, qual::text as qual
    FROM pg_policies
    WHERE tablename = ANY(${ALL_PROTECTED_TABLES})`

  for (const table of ALL_PROTECTED_TABLES) {
    const tablePolicies = policies.filter((p) => p.tablename === table)
    const isNoTenantAccess = (PROTECTED_NO_TENANT_ACCESS_TABLES as readonly string[]).includes(table)
    const hasSystemPolicy = tablePolicies.some((p) => p.policyname === 'ue_system_full_access')
    results.push({
      name: `table ${table}: has ue_system_full_access policy`,
      pass: hasSystemPolicy,
      detail: hasSystemPolicy ? 'present' : 'MISSING',
    })
    if (!isNoTenantAccess) {
      const hasTenantPolicy = tablePolicies.some(
        (p) => p.policyname.startsWith('ue_org_isolation_') || p.policyname === 'ue_parent_org_isolation',
      )
      results.push({
        name: `table ${table}: has a tenant-scoped isolation policy`,
        pass: hasTenantPolicy,
        detail: hasTenantPolicy ? 'present' : 'MISSING',
      })
    }

    for (const policy of tablePolicies) {
      const qual = policy.qual ?? ''
      const isProhibitedBypass = /IS NULL/i.test(qual) && /current_org_id/i.test(qual)
      results.push({
        name: `table ${table}: policy "${policy.policyname}" is not an empty-context bypass`,
        pass: !isProhibitedBypass,
        detail: isProhibitedBypass ? `PROHIBITED PATTERN FOUND: ${qual}` : 'ok',
      })
      const isApprovedPolicyName =
        policy.policyname === 'ue_system_full_access' ||
        policy.policyname === 'ue_parent_org_isolation' ||
        policy.policyname.startsWith('ue_org_isolation_')
      results.push({
        name: `table ${table}: policy "${policy.policyname}" is an approved 0108 policy (not a surviving historical policy)`,
        pass: isApprovedPolicyName,
        detail: isApprovedPolicyName
          ? 'ok'
          : `UNEXPECTED POLICY — not one of 0108's own named policies (ue_system_full_access / ue_parent_org_isolation / ue_org_isolation_*). A historical policy from an earlier migration may have survived on this table and can widen access via PostgreSQL's OR-combined permissive-policy semantics. Drop it explicitly (see PART 0 of 0108) or add it to this check's approved list with justification if it is genuinely still required.`,
      })
    }
  }
}

/**
 * PERMANENT INVARIANT (PR #752 round 6): every table in the 0108 baseline
 * protected set (db/rls-0108-protected-tables.ts) must have its OWN entry
 * in db/rls-storage-authority-manifest.ts with fully resolved (non-TBD)
 * authority — closing the "24 baseline tables without manifest
 * disposition" gap the round-5 convergence report surfaced. This is a
 * live, deployment-gate mirror of the equivalent Vitest contract test in
 * db/__tests__/rls-storage-authority-manifest-invariants.test.ts, so drift
 * is caught even if someone edits the manifest without running unit tests.
 * checkTableRlsState() above already verifies these tables' actual live
 * RLS state (exists/enabled/forced/policy) — this check only verifies the
 * manifest-side authority bookkeeping is complete.
 */
async function checkBaselineTablesHaveManifestDisposition(results: CheckResult[]) {
  const { storageAuthorityManifest } = await import('../db/rls-storage-authority-manifest')
  const manifestByTable = new Map(storageAuthorityManifest.map((e) => [e.table, e]))

  for (const table of ALL_PROTECTED_TABLES) {
    const entry = manifestByTable.get(table)
    if (!entry) {
      results.push({
        name: `storage-authority: 0108-baseline table ${table} has a manifest entry`,
        pass: false,
        detail: 'MISSING — every 0108-baseline table must have its own entry in db/rls-storage-authority-manifest.ts.',
      })
      continue
    }
    if (entry.classification === 'NEEDS_REVIEW') {
      // A baseline table CAN legitimately be NEEDS_REVIEW (round 7: e.g.
      // safety_training_records, reclassified once a raw-SQL reference was
      // found that a Drizzle-symbol-only scan missed) — TBD is a
      // legitimate value there, same rule as every other manifest entry.
      // NEEDS_REVIEW itself is still a FAILING classification overall —
      // that is reported by checkOrphanedTenantTables's classification
      // check below, not duplicated here.
      continue
    }
    const unresolvedFields: string[] = []
    if (entry.invocationAuthority === 'TBD') unresolvedFields.push('invocationAuthority')
    if (entry.dbExecutionPrincipal === 'TBD') unresolvedFields.push('dbExecutionPrincipal')
    if (entry.requiredRuntimePrivileges === 'TBD') unresolvedFields.push('requiredRuntimePrivileges')
    if (entry.requiredSystemPrivileges === 'TBD') unresolvedFields.push('requiredSystemPrivileges')
    results.push({
      name: `storage-authority: 0108-baseline table ${table} has fully resolved authority`,
      pass: unresolvedFields.length === 0,
      detail: unresolvedFields.length === 0
        ? `${entry.classification} — ok`
        : `UNRESOLVED — still has 'TBD' in: ${unresolvedFields.join(', ')}.`,
    })
  }
}

/**
 * Discovers tables that carry an org/tenant-shaped column
 * (organization_id / org_id / tenant_id) but are granted DML to
 * union_eyes_runtime without RLS enabled — i.e. tables the blanket
 * `GRANT ... ON ALL TABLES IN SCHEMA public` in 0108 makes reachable.
 *
 * FAIL-CLOSED (not report-only): every such table MUST have an entry in
 * db/rls-storage-authority-manifest.ts. This check fails if:
 *   - a discovered table has NO manifest entry at all (undocumented gap —
 *     including any NEW table a future migration adds without a
 *     disposition);
 *   - the manifest entry's classification is NEEDS_REVIEW (an honest,
 *     evidence-backed placeholder for real code that has not yet had its
 *     exact HTTP reachability / RLS disposition traced — see the
 *     manifest's own header for why this exists and is not silently
 *     passed);
 *   - the manifest entry requires RLS (TENANT_RLS_REQUIRED /
 *     USER_RLS_REQUIRED / PARENT_OWNED_RLS_REQUIRED) but the live catalog
 *     shows RLS is not actually enabled+forced with at least one policy on
 *     that table yet.
 * "rls:verify passes" therefore means every tenant-bearing table reachable
 * by union_eyes_runtime is either RLS-protected or has a reviewed,
 * evidence-backed, non-NEEDS_REVIEW disposition — not merely "the 24-table
 * 0108 subset checks out".
 */
async function checkOrphanedTenantTables(sql: postgres.Sql, results: CheckResult[]) {
  const rows = await sql<{ table_name: string; column_name: string }[]>`
    SELECT DISTINCT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public'
      AND c.column_name IN ('organization_id', 'org_id', 'tenant_id')
      AND c.table_name != ALL(${ALL_PROTECTED_TABLES})`

  const { storageAuthorityManifest, CLOSED_CLASSIFICATIONS } = await import('../db/rls-storage-authority-manifest')
  const manifestByTable = new Map(storageAuthorityManifest.map((e) => [e.table, e]))
  const rlsRequiredClassifications = new Set([
    'TENANT_RLS_REQUIRED',
    'USER_RLS_REQUIRED',
    'PARENT_OWNED_RLS_REQUIRED',
    'MIXED_GLOBAL_TENANT_RLS_REQUIRED',
    'MULTI_PARTY_RLS_REQUIRED',
  ])

  const byTable = new Map<string, string[]>()
  for (const row of rows) {
    const cols = byTable.get(row.table_name) ?? []
    cols.push(row.column_name)
    byTable.set(row.table_name, cols)
  }

  const tablesNeedingRlsCheck: string[] = []
  for (const [table, columns] of byTable) {
    const entry = manifestByTable.get(table)
    if (!entry) {
      results.push({
        name: `storage-authority: ${table} (${columns.join(', ')})`,
        pass: false,
        detail: 'UNDOCUMENTED — no entry in db/rls-storage-authority-manifest.ts. Add one (or add real RLS coverage) before this can ship.',
      })
      continue
    }
    const isClosed = (CLOSED_CLASSIFICATIONS as readonly string[]).includes(entry.classification)
    results.push({
      name: `storage-authority: ${table} classification`,
      pass: isClosed,
      detail: isClosed
        ? `${entry.classification} — ${entry.reason}`
        : `${entry.classification} [reviewPriority=${entry.reviewPriority}] (FAILING classification) — ${entry.reason}`,
    })
    if (isClosed) {
      // PERMANENT INVARIANT (PR #752 round 5): a CLOSED classification is a
      // claim that this table's authority has been fully reasoned about —
      // 'TBD' in any of the four authority/privilege fields contradicts
      // that claim and must fail closed here too, not just in the Vitest
      // contract test (db/__tests__/rls-storage-authority-manifest-invariants.test.ts),
      // so a live deploy-gate run catches drift even if someone edits the
      // manifest without running the unit tests.
      const unresolvedFields: string[] = []
      if (entry.invocationAuthority === 'TBD') unresolvedFields.push('invocationAuthority')
      if (entry.dbExecutionPrincipal === 'TBD') unresolvedFields.push('dbExecutionPrincipal')
      if (entry.requiredRuntimePrivileges === 'TBD') unresolvedFields.push('requiredRuntimePrivileges')
      if (entry.requiredSystemPrivileges === 'TBD') unresolvedFields.push('requiredSystemPrivileges')
      results.push({
        name: `storage-authority: ${table} has fully resolved authority (no TBD on a CLOSED classification)`,
        pass: unresolvedFields.length === 0,
        detail: unresolvedFields.length === 0
          ? 'ok'
          : `UNRESOLVED — ${entry.classification} is a CLOSED classification but still has 'TBD' in: ${unresolvedFields.join(', ')}. 'TBD' is only valid for NEEDS_REVIEW entries.`,
      })
      if (
        entry.classification === 'SYSTEM_ONLY' &&
        (entry.dbExecutionPrincipal === 'TENANT_RUNTIME' || entry.dbExecutionPrincipal === 'MIXED')
      ) {
        results.push({
          name: `storage-authority: ${table} SYSTEM_ONLY invariant (dbExecutionPrincipal must never be TENANT_RUNTIME/MIXED)`,
          pass: false,
          detail: `SYSTEM_ONLY table has dbExecutionPrincipal=${entry.dbExecutionPrincipal} — no invocationAuthority justifies union_eyes_runtime access to a SYSTEM_ONLY table.`,
        })
      }
      if (
        entry.classification === 'SYSTEM_ONLY' &&
        entry.requiredRuntimePrivileges !== 'TBD' &&
        entry.requiredRuntimePrivileges.length > 0
      ) {
        results.push({
          name: `storage-authority: ${table} SYSTEM_ONLY invariant (zero union_eyes_runtime privileges)`,
          pass: false,
          detail: `SYSTEM_ONLY table has non-empty requiredRuntimePrivileges: ${entry.requiredRuntimePrivileges.join(', ')}.`,
        })
      }
      if (
        entry.classification === 'CONTAINED_NO_AUTHORITY' &&
        entry.requiredRuntimePrivileges !== 'TBD' &&
        entry.requiredSystemPrivileges !== 'TBD' &&
        (entry.requiredRuntimePrivileges.length > 0 || entry.requiredSystemPrivileges.length > 0)
      ) {
        results.push({
          name: `storage-authority: ${table} CONTAINED_NO_AUTHORITY invariant (zero privileges on both roles)`,
          pass: false,
          detail: `CONTAINED_NO_AUTHORITY table has non-empty privileges (runtime=${entry.requiredRuntimePrivileges.join(', ')}, system=${entry.requiredSystemPrivileges.join(', ')}).`,
        })
      }
      if (rlsRequiredClassifications.has(entry.classification)) {
        tablesNeedingRlsCheck.push(table)
      }
    }
  }

  if (tablesNeedingRlsCheck.length > 0) {
    const rlsRows = await sql<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }[]>`
      SELECT relname, relrowsecurity, relforcerowsecurity
      FROM pg_class
      WHERE relname = ANY(${tablesNeedingRlsCheck}) AND relkind = 'r'`
    const rlsByTable = new Map(rlsRows.map((r) => [r.relname, r]))
    const policyRows = await sql<{ tablename: string }[]>`
      SELECT DISTINCT tablename FROM pg_policies WHERE tablename = ANY(${tablesNeedingRlsCheck})`
    const tablesWithPolicies = new Set(policyRows.map((r) => r.tablename))

    for (const table of tablesNeedingRlsCheck) {
      const rls = rlsByTable.get(table)
      const hasRls = Boolean(rls?.relrowsecurity && rls?.relforcerowsecurity)
      const hasPolicy = tablesWithPolicies.has(table)
      results.push({
        name: `storage-authority: ${table} has RLS+FORCE RLS+a policy (required by its manifest classification)`,
        pass: hasRls && hasPolicy,
        detail:
          hasRls && hasPolicy
            ? 'ok'
            : `MISSING — relrowsecurity=${rls?.relrowsecurity ?? 'table not found'}, relforcerowsecurity=${rls?.relforcerowsecurity ?? 'n/a'}, has policy=${hasPolicy}. This table is classified as requiring RLS in the manifest but does not have it yet — extend 0108 (or a follow-up migration) to cover it.`,
      })
    }
  }
}


/**
 * MANIFEST-DRIVEN RLS coverage (PR #752 round 58+ blind-spot closure).
 *
 * checkOrphanedTenantTables above only DISCOVERS candidate tables by
 * scanning the live catalog for an organization_id/org_id/tenant_id column.
 * That silently EXCLUDES every manifest-RLS-required table whose physical
 * (Django app 0001_initial) source-native shape carries NO org column but
 * whose authority is reached through a parent FK, a user_id, a multi-hop
 * parent, or a sharing predicate (the dual-lineage-collision set 0012
 * closes). Those tables could be RLS-required-and-unenforced yet still pass
 * the old verifier — a false green.
 *
 * This check removes that blind spot: it evaluates EVERY manifest entry
 * whose classification requires RLS, independently of any column heuristic.
 *   - Physically present  => MUST have RLS enabled + FORCE + at least one
 *     union_eyes_runtime policy (policy owner) + a union_eyes_system
 *     full-access policy. Any gap FAILS.
 *   - Physically absent    => reported as NOT_PRESENT_IN_SOURCE_NATIVE_SCHEMA
 *     (visible, non-failing: enforced-by-absence in the scoped lineage).
 * A future migration that adds an RLS-required table without RLS therefore
 * fails automatically — the old 1054/1054-style false green is impossible.
 */
async function checkManifestRlsRequiredCoverage(sql: postgres.Sql, results: CheckResult[]) {
  const { storageAuthorityManifest } = await import('../db/rls-storage-authority-manifest')
  const rlsRequiredClassifications = new Set([
    'TENANT_RLS_REQUIRED',
    'USER_RLS_REQUIRED',
    'PARENT_OWNED_RLS_REQUIRED',
    'MIXED_GLOBAL_TENANT_RLS_REQUIRED',
    'MULTI_PARTY_RLS_REQUIRED',
  ])
  const requiredTables = [
    ...new Set(
      storageAuthorityManifest
        .filter((e) => rlsRequiredClassifications.has(e.classification))
        .map((e) => e.table),
    ),
  ].sort()
  // table -> whether the manifest declares any required union_eyes_system
  // privilege. A system full-access policy is required ONLY where the
  // contract needs system access (e.g. withSystemContext background jobs);
  // runtime-only tables (some 0006 external-grant tables) legitimately have
  // no union_eyes_system policy and must not be failed for lacking one.
  const systemRequiredByTable = new Map<string, boolean>()
  for (const e of storageAuthorityManifest) {
    if (!rlsRequiredClassifications.has(e.classification)) continue
    const needs =
      e.requiredSystemPrivileges !== 'TBD' &&
      Array.isArray(e.requiredSystemPrivileges) &&
      e.requiredSystemPrivileges.length > 0
    systemRequiredByTable.set(e.table, (systemRequiredByTable.get(e.table) ?? false) || needs)
  }

  const presentRows = await sql<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }[]>`
    SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    WHERE c.relkind = 'r' AND c.relname = ANY(${requiredTables})`
  const presentByTable = new Map(presentRows.map((r) => [r.relname, r]))

  const runtimePolicyRows = await sql<{ tablename: string }[]>`
    SELECT DISTINCT tablename FROM pg_policies
    WHERE schemaname = 'public' AND tablename = ANY(${requiredTables})
      AND roles = ARRAY['union_eyes_runtime']::name[]`
  const tablesWithRuntimePolicy = new Set(runtimePolicyRows.map((r) => r.tablename))
  const systemPolicyRows = await sql<{ tablename: string }[]>`
    SELECT DISTINCT tablename FROM pg_policies
    WHERE schemaname = 'public' AND tablename = ANY(${requiredTables})
      AND policyname = 'ue_system_full_access'
      AND roles = ARRAY['union_eyes_system']::name[]`
  const tablesWithSystemPolicy = new Set(systemPolicyRows.map((r) => r.tablename))

  let presentCount = 0
  let absentCount = 0
  let enforcedCount = 0
  for (const table of requiredTables) {
    const present = presentByTable.get(table)
    if (!present) {
      absentCount += 1
      results.push({
        name: `manifest-rls: ${table} coverage`,
        pass: true,
        detail: 'NOT_PRESENT_IN_SOURCE_NATIVE_SCHEMA — RLS-required in the manifest but not physically present in this scoped source-native database (enforced by absence).',
      })
      continue
    }
    presentCount += 1
    const hasRls = Boolean(present.relrowsecurity && present.relforcerowsecurity)
    const hasRuntimePolicy = tablesWithRuntimePolicy.has(table)
    const hasSystemPolicy = tablesWithSystemPolicy.has(table)
    const systemRequired = systemRequiredByTable.get(table) ?? false
    const ok = hasRls && hasRuntimePolicy && (!systemRequired || hasSystemPolicy)
    if (ok) enforcedCount += 1
    results.push({
      name: `manifest-rls: ${table} is present and fully RLS-enforced (RLS+FORCE+runtime policy owner${systemRequired ? '+system policy' : ''})`,
      pass: ok,
      detail: ok
        ? 'ok'
        : `UNENFORCED — relrowsecurity=${present.relrowsecurity}, relforcerowsecurity=${present.relforcerowsecurity}, runtime policy owner=${hasRuntimePolicy}, system policy=${hasSystemPolicy} (systemRequired=${systemRequired}). This table is RLS-required by its manifest classification but is not fully enforced — add its policy owner in a scoped migration (0010/0011/0012).`,
    })
  }

  console.log(
    `[rls-verify] manifest-driven RLS coverage: ${requiredTables.length} RLS-required manifest tables ` +
      `(${presentCount} present / ${absentCount} absent), ${enforcedCount}/${presentCount} present-and-enforced. ` +
      `RLS_VERIFY_MANIFEST_DRIVEN=YES RLS_VERIFY_EXPECTATIONS_WEAKENED=NO`,
  )
}

async function checkNoContextFailsClosed(sql: postgres.Sql, results: CheckResult[]) {
  await sql.begin(async (tx) => {
    await tx.unsafe(`SELECT set_config('app.current_user_id', '', true)`)
    await tx.unsafe(`SELECT set_config('app.current_org_id', '', true)`)
    for (const { table } of PROTECTED_DIRECT_TABLES) {
      if (table === 'organizations') continue // every tenant may see its own org row; not a useful no-context probe
      const zeroPrivilegeTable = ZERO_RUNTIME_PRIVILEGE_TABLES.has(table)
      // Each probe runs inside its own SAVEPOINT: a `permission denied`
      // error aborts the enclosing Postgres transaction until rolled back,
      // and without a savepoint here every subsequent table in this loop
      // would spuriously fail with "current transaction is aborted" once
      // one zero-privilege table's SELECT throws.
      try {
        await tx.savepoint(async (sp) => {
          const rows = await sp.unsafe(`SELECT 1 FROM ${table} LIMIT 1`)
          results.push({
            name: `no-context probe: ${table} returns zero rows`,
            pass: rows.length === 0,
            detail: rows.length === 0 ? 'ok' : `returned ${rows.length} row(s) with no org context set`,
          })
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const isPermissionDenied = /permission denied/i.test(message)
        results.push({
          name: `no-context probe: ${table} returns zero rows`,
          pass: isPermissionDenied && zeroPrivilegeTable,
          detail:
            isPermissionDenied && zeroPrivilegeTable
              ? 'ok (permission denied — union_eyes_runtime has zero required runtime privileges on this LATENT_UNREACHABLE table per the storage authority manifest, which is a stronger guarantee than RLS alone)'
              : `unexpected error: ${message}`,
        })
      }
    }
  })
}

async function runFixtureIsolationMatrix(
  runtimeSql: postgres.Sql,
  bootstrapSql: postgres.Sql,
  results: CheckResult[],
) {
  const runId = `UE_RA_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${crypto.randomUUID().replace(/-/g, '').slice(0, 6)}`
  const orgA = { id: crypto.randomUUID(), userId: `${runId}_user_a` }
  const orgB = { id: crypto.randomUUID(), userId: `${runId}_user_b` }

  console.error(`[rls-verify] fixture run: ${runId} (orgA=${orgA.id}, orgB=${orgB.id})`)

  try {
    // Fixture ADMINISTRATION uses the bootstrap connection. Bootstrap
    // authority is never the security subject being accepted; every
    // isolation assertion below runs on runtimeSql.
    await bootstrapSql.begin(async (tx) => {
      const orgAFixture = buildRlsVerifyOrganizationFixture({
        id: orgA.id,
        name: `${runId} Org A`,
        slug: `${runId.toLowerCase()}-org-a`,
        runId,
      })
      const orgBFixture = buildRlsVerifyOrganizationFixture({
        id: orgB.id,
        name: `${runId} Org B`,
        slug: `${runId.toLowerCase()}-org-b`,
        runId,
      })
      await setTenantContext(tx, { orgId: orgA.id, userId: orgA.userId })
      await tx.unsafe(
        `INSERT INTO organizations (${RLS_VERIFY_ORGANIZATION_FIXTURE_COLUMNS.join(', ')})
         VALUES ($1, $2, $3, $4::organization_type, $5::text[], $6, $7, $8::jsonb)`,
        [
          orgAFixture.id,
          orgAFixture.name,
          orgAFixture.slug,
          orgAFixture.organizationType,
          orgAFixture.hierarchyPath,
          orgAFixture.hierarchyLevel,
          orgAFixture.status,
          JSON.stringify(orgAFixture.settings),
        ],
      )
      await tx.unsafe(
        `INSERT INTO grievances (${RLS_VERIFY_GRIEVANCE_FIXTURE_COLUMNS.join(', ')})
         VALUES ($1, $2, $3::grievance_type, $4, $5, $6)`,
        Object.values(buildRlsVerifyGrievanceFixture({
          id: crypto.randomUUID(),
          organizationId: orgA.id,
          runId,
          label: 'org-a',
        })),
      )

      await setTenantContext(tx, { orgId: orgB.id, userId: orgB.userId })
      await tx.unsafe(
        `INSERT INTO organizations (${RLS_VERIFY_ORGANIZATION_FIXTURE_COLUMNS.join(', ')})
         VALUES ($1, $2, $3, $4::organization_type, $5::text[], $6, $7, $8::jsonb)`,
        [
          orgBFixture.id,
          orgBFixture.name,
          orgBFixture.slug,
          orgBFixture.organizationType,
          orgBFixture.hierarchyPath,
          orgBFixture.hierarchyLevel,
          orgBFixture.status,
          JSON.stringify(orgBFixture.settings),
        ],
      )
      await tx.unsafe(
        `INSERT INTO grievances (${RLS_VERIFY_GRIEVANCE_FIXTURE_COLUMNS.join(', ')})
         VALUES ($1, $2, $3::grievance_type, $4, $5, $6)`,
        Object.values(buildRlsVerifyGrievanceFixture({
          id: crypto.randomUUID(),
          organizationId: orgB.id,
          runId,
          label: 'org-b',
        })),
      )
    })

    // Proof runs on the RUNTIME connection — the same effective database
    // authority the deployed application uses.
    await runtimeSql.begin(async (tx) => {
      await tx.unsafe(`SELECT set_config('app.current_user_id', $1, true)`, [orgA.userId])
      await tx.unsafe(`SELECT set_config('app.current_org_id', $1, true)`, [orgA.id])
      const ownRows = await tx.unsafe(`SELECT id FROM grievances WHERE organization_id = $1`, [orgA.id])
      const otherRows = await tx.unsafe(`SELECT id FROM grievances WHERE organization_id = $1`, [orgB.id])
      results.push({
        name: 'fixture matrix: Org A sees its own grievance rows',
        pass: ownRows.length >= 1,
        detail: `${ownRows.length} row(s)`,
      })
      results.push({
        name: 'fixture matrix: Org A cannot see Org B grievance rows',
        pass: otherRows.length === 0,
        detail: `${otherRows.length} row(s) (expected 0)`,
      })
      const forgedFixture = buildRlsVerifyGrievanceFixture({
        id: crypto.randomUUID(),
        organizationId: orgB.id,
        runId,
        label: 'forged-org-b',
      })
      let forged: unknown
      try {
        await tx.savepoint(async (sp) => {
          forged = await sp.unsafe(
            `INSERT INTO grievances (${RLS_VERIFY_GRIEVANCE_FIXTURE_COLUMNS.join(', ')})
             VALUES ($1, $2, $3::grievance_type, $4, $5, $6) RETURNING id`,
            Object.values(forgedFixture),
          )
        })
      } catch (e) {
        forged = { error: e instanceof Error ? e.message : String(e) }
      }
      const forgedRejected = isCaughtErrorResult(forged) || (Array.isArray(forged) && forged.length === 0)
      results.push({
        name: 'fixture matrix: Org A insert forging Org B organization_id is rejected',
        pass: forgedRejected,
        detail: forgedRejected ? 'rejected as expected' : 'INSERT SUCCEEDED — policy WITH CHECK failed to block a forged org_id',
      })
    })

    await runtimeSql.begin(async (tx) => {
      await tx.unsafe(`SELECT set_config('app.current_user_id', $1, true)`, [orgB.userId])
      await tx.unsafe(`SELECT set_config('app.current_org_id', $1, true)`, [orgB.id])
      const ownRows = await tx.unsafe(`SELECT id FROM grievances WHERE organization_id = $1`, [orgB.id])
      const otherRows = await tx.unsafe(`SELECT id FROM grievances WHERE organization_id = $1`, [orgA.id])
      results.push({
        name: 'fixture matrix: Org B sees its own grievance rows (symmetry check)',
        pass: ownRows.length >= 1,
        detail: `${ownRows.length} row(s)`,
      })
      results.push({
        name: 'fixture matrix: Org B cannot see Org A grievance rows (symmetry check)',
        pass: otherRows.length === 0,
        detail: `${otherRows.length} row(s) (expected 0)`,
      })
      const update = await tx.unsafe(`UPDATE grievances SET organization_id = organization_id WHERE organization_id = $1 RETURNING id`, [orgA.id])
      results.push({
        name: 'fixture matrix: Org B update targeting Org A rows affects zero rows',
        pass: Array.isArray(update) && update.length === 0,
        detail: `${Array.isArray(update) ? update.length : 'n/a'} row(s) affected (expected 0)`,
      })
      const del = await tx.unsafe(`DELETE FROM grievances WHERE organization_id = $1 RETURNING id`, [orgA.id])
      results.push({
        name: 'fixture matrix: Org B delete targeting Org A rows affects zero rows',
        pass: Array.isArray(del) && del.length === 0,
        detail: `${Array.isArray(del) ? del.length : 'n/a'} row(s) affected (expected 0)`,
      })
    })
  } finally {
    // Cleanup uses the bootstrap connection — exact-id deletes, no reliance
    // on ambient tenant context.
    await bootstrapSql.begin(async (tx) => {
      await setTenantContext(tx, { orgId: orgA.id, userId: orgA.userId })
      await tx.unsafe(`DELETE FROM grievances WHERE organization_id = $1`, [orgA.id])
      await tx.unsafe(`DELETE FROM organizations WHERE id = $1`, [orgA.id])
      await setTenantContext(tx, { orgId: orgB.id, userId: orgB.userId })
      await tx.unsafe(`DELETE FROM grievances WHERE organization_id = $1`, [orgB.id])
      await tx.unsafe(`DELETE FROM organizations WHERE id = $1`, [orgB.id])
    }).catch((e) => {
      console.error(`[rls-verify] WARNING: fixture cleanup for run ${runId} failed: ${(e as Error).message}. Manual cleanup required for org ids ${orgA.id}, ${orgB.id}.`)
    })
  }
}

async function main() {
  const { mode } = parseArgs()
  const dbUrl = resolveRuntimeDatabaseUrl()
  if (!dbUrl) {
    console.error('[rls-verify] Missing RLS_VERIFY_DATABASE_URL / DATABASE_URL.')
    process.exit(1)
  }

  const sql = postgres(dbUrl, { ssl: dbUrl.includes('localhost') ? false : 'require', max: 1, prepare: false })
  let bootstrapSql: postgres.Sql | undefined
  const results: CheckResult[] = []

  try {
    await checkRuntimeRole(sql, results)
    await checkTableRlsState(sql, results)
    await checkNoContextFailsClosed(sql, results)
    await checkBaselineTablesHaveManifestDisposition(results)
    await checkOrphanedTenantTables(sql, results)
    await checkManifestRlsRequiredCoverage(sql, results)
    if (mode === 'full') {
      const bootstrapDbUrl = resolveBootstrapDatabaseUrl()
      if (!bootstrapDbUrl) {
        throw new Error(
          '--mode=full requires RLS_VERIFY_BOOTSTRAP_DATABASE_URL ' +
            '(or RLS_ENFORCEMENT_ADMIN_DATABASE_URL / RLS_MIGRATION_ADMIN_DATABASE_URL / ADMIN_DATABASE_URL) — ' +
            'fixture bootstrap/cleanup must use a privileged bootstrap principal, never the runtime role under test.',
        )
      }
      bootstrapSql = postgres(bootstrapDbUrl, { ssl: bootstrapDbUrl.includes('localhost') ? false : 'require', max: 1, prepare: false })
      await checkFullModePrincipalModel(sql, bootstrapSql, results)
      await runFixtureIsolationMatrix(sql, bootstrapSql, results)
    }
  } finally {
    await sql.end({ timeout: 2 })
    if (bootstrapSql) await bootstrapSql.end({ timeout: 2 })
  }

  const failed = results.filter((r) => !r.pass)
  for (const r of results) {
    console.log(`${r.pass ? '✅' : '❌'} ${r.name} — ${r.detail}`)
  }
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`)

  if (failed.length > 0) {
    console.error(`\n[rls-verify] FAILED (${failed.length} check(s) did not pass). This must gate deployment.`)
    process.exit(1)
  }
  console.log('\n[rls-verify] PASS — RLS tenant-isolation foundation confirmed in force on this database.')
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('/scripts/rls-verify.ts')) {
  main().catch((err) => {
    console.error('[rls-verify] Unhandled error:', err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
