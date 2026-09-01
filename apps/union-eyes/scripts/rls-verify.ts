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
 * for the tenant runtime role, and RLS_VERIFY_SYSTEM_DATABASE_URL (falling
 * back to SYSTEM_DATABASE_URL) for the system role, when --mode=full needs
 * to confirm the system role's separate, unconditional access. Never prints
 * either connection string.
 *
 * Exit code: 0 on all checks passing, 1 on any failure. Intended to gate
 * CI/deployment — see the fix PR description for wiring into the pipeline.
 */
import postgres from 'postgres'

interface CheckResult {
  name: string
  pass: boolean
  detail: string
}

const PROTECTED_DIRECT_TABLES = [
  { table: 'organization_members', orgColumn: 'organization_id', orgColumnIsText: true },
  { table: 'organizations', orgColumn: 'id', orgColumnIsText: false },
  { table: 'grievances', orgColumn: 'organization_id', orgColumnIsText: false },
  { table: 'claims', orgColumn: 'organization_id', orgColumnIsText: false },
  { table: 'grievance_deadlines', orgColumn: 'organization_id', orgColumnIsText: false },
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

const PROTECTED_PARENT_OWNED_TABLES = [
  'messages',
  'message_participants',
  'message_read_receipts',
  'message_notifications',
] as const

const PROTECTED_NO_TENANT_ACCESS_TABLES = ['cross_org_access_log'] as const

const ALL_PROTECTED_TABLES = [
  ...PROTECTED_DIRECT_TABLES.map((t) => t.table),
  ...PROTECTED_PARENT_OWNED_TABLES,
  ...PROTECTED_NO_TENANT_ACCESS_TABLES,
]

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
  const [identity] = await sql`SELECT current_user`
  const [attrs] = await sql`
    SELECT rolname, rolsuper, rolbypassrls
    FROM pg_roles WHERE rolname = current_user`

  results.push({
    name: 'runtime-role: connected as union_eyes_runtime',
    pass: identity.current_user === 'union_eyes_runtime',
    detail: `current_user = ${identity.current_user}`,
  })
  results.push({
    name: 'runtime-role: NOSUPERUSER',
    pass: attrs?.rolsuper === false,
    detail: `rolsuper = ${attrs?.rolsuper}`,
  })
  results.push({
    name: 'runtime-role: NOBYPASSRLS',
    pass: attrs?.rolbypassrls === false,
    detail: `rolbypassrls = ${attrs?.rolbypassrls}`,
  })
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
  const rlsRequiredClassifications = new Set(['TENANT_RLS_REQUIRED', 'USER_RLS_REQUIRED', 'PARENT_OWNED_RLS_REQUIRED'])

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
    if (isClosed && rlsRequiredClassifications.has(entry.classification)) {
      tablesNeedingRlsCheck.push(table)
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


async function checkNoContextFailsClosed(sql: postgres.Sql, results: CheckResult[]) {
  await sql.begin(async (tx) => {
    await tx.unsafe(`SELECT set_config('app.current_user_id', '', true)`)
    await tx.unsafe(`SELECT set_config('app.current_org_id', '', true)`)
    for (const { table } of PROTECTED_DIRECT_TABLES) {
      if (table === 'organizations') continue // every tenant may see its own org row; not a useful no-context probe
      const rows = await tx.unsafe(`SELECT 1 FROM ${table} LIMIT 1`)
      results.push({
        name: `no-context probe: ${table} returns zero rows`,
        pass: rows.length === 0,
        detail: rows.length === 0 ? 'ok' : `returned ${rows.length} row(s) with no org context set`,
      })
    }
  })
}

async function runFixtureIsolationMatrix(
  runtimeSql: postgres.Sql,
  systemSql: postgres.Sql,
  results: CheckResult[],
) {
  const runId = `UE_RA_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${Math.random().toString(36).slice(2, 8)}`
  const orgA = { id: crypto.randomUUID(), userId: `${runId}_user_a` }
  const orgB = { id: crypto.randomUUID(), userId: `${runId}_user_b` }

  console.error(`[rls-verify] fixture run: ${runId} (orgA=${orgA.id}, orgB=${orgB.id})`)

  try {
    // Fixture ADMINISTRATION uses the system connection (unconditional access
    // via ue_system_full_access) — this is bootstrap authority, never used
    // below to make an isolation assertion. In --mode=full this MUST be a
    // disposable database, not shared staging.
    await systemSql.begin(async (tx) => {
      await tx.unsafe(
        `INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3), ($4, $5, $6)`,
        [
          orgA.id, `${runId} Org A`, `${runId.toLowerCase()}-org-a`,
          orgB.id, `${runId} Org B`, `${runId.toLowerCase()}-org-b`,
        ],
      )
      await tx.unsafe(
        `INSERT INTO grievances (id, organization_id) VALUES ($1, $2)`,
        [crypto.randomUUID(), orgA.id],
      )
      await tx.unsafe(
        `INSERT INTO grievances (id, organization_id) VALUES ($1, $2)`,
        [crypto.randomUUID(), orgB.id],
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
      const forged = await tx.unsafe(
        `INSERT INTO grievances (id, organization_id) VALUES (gen_random_uuid(), $1) RETURNING id`,
        [orgB.id],
      ).catch((e: Error) => ({ error: e.message }))
      const forgedRejected = 'error' in (forged as any) || (Array.isArray(forged) && forged.length === 0)
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
    // Cleanup uses the system connection — exact-id deletes, no reliance on
    // any tenant context.
    await systemSql.begin(async (tx) => {
      await tx.unsafe(`DELETE FROM grievances WHERE organization_id IN ($1, $2)`, [orgA.id, orgB.id])
      await tx.unsafe(`DELETE FROM organizations WHERE id IN ($1, $2)`, [orgA.id, orgB.id])
    }).catch((e) => {
      console.error(`[rls-verify] WARNING: fixture cleanup for run ${runId} failed: ${(e as Error).message}. Manual cleanup required for org ids ${orgA.id}, ${orgB.id}.`)
    })
  }
}

async function main() {
  const { mode } = parseArgs()
  const dbUrl = process.env.RLS_VERIFY_DATABASE_URL || process.env.DATABASE_URL
  if (!dbUrl) {
    console.error('[rls-verify] Missing RLS_VERIFY_DATABASE_URL / DATABASE_URL.')
    process.exit(1)
  }

  const sql = postgres(dbUrl, { ssl: dbUrl.includes('localhost') ? false : 'require', max: 1, prepare: false })
  let systemSql: postgres.Sql | undefined
  const results: CheckResult[] = []

  try {
    await checkRuntimeRole(sql, results)
    await checkTableRlsState(sql, results)
    await checkNoContextFailsClosed(sql, results)
    await checkOrphanedTenantTables(sql, results)
    if (mode === 'full') {
      const systemDbUrl = process.env.RLS_VERIFY_SYSTEM_DATABASE_URL || process.env.SYSTEM_DATABASE_URL
      if (!systemDbUrl) {
        throw new Error(
          '--mode=full requires RLS_VERIFY_SYSTEM_DATABASE_URL / SYSTEM_DATABASE_URL — ' +
            'fixture bootstrap/cleanup runs as union_eyes_system, never as the runtime role.',
        )
      }
      systemSql = postgres(systemDbUrl, { ssl: systemDbUrl.includes('localhost') ? false : 'require', max: 1, prepare: false })
      await runFixtureIsolationMatrix(sql, systemSql, results)
    }
  } finally {
    await sql.end({ timeout: 2 })
    if (systemSql) await systemSql.end({ timeout: 2 })
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

main().catch((err) => {
  console.error('[rls-verify] Unhandled error:', err instanceof Error ? err.message : err)
  process.exit(1)
})
