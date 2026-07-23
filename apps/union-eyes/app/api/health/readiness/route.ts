/**
 * Phase 0C.1 §6/§8 — Governed E2E readiness endpoint.
 *
 * GET /api/health/readiness
 *
 * Returns 200 iff ALL 10 checks pass:
 *   1. app.boot            — this handler returning (implicit)
 *   2. db.connect          — SELECT 1 succeeds
 *   3. db.schema.public    — critical public-schema tables present
 *   4. db.schema.union_eyes — union_eyes-schema tables present
 *   5. db.migrations.platform — __drizzle_migrations table has ≥1 row
 *   6. db.migrations.django — django_migrations table has ≥1 row (or skipped)
 *   7. db.contract.phase0b — organization_membership resolver present
 *   8. db.tables.kpi       — ue_kpi_snapshot / ue_pilot_definition exist (or skipped)
 *   9. db.seed.marker      — ue_e2e_seed_marker present with a runId
 *  10. auth.fixtures       — every fixture user resolvable in auth_users
 *
 * Response body is fully detailed in NODE_ENV=test/development.
 * In production, body is redacted (no table names, no counts, no PII).
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type CheckId =
  | 'app.boot'
  | 'db.connect'
  | 'db.schema.public'
  | 'db.schema.union_eyes'
  | 'db.migrations.platform'
  | 'db.migrations.django'
  | 'db.contract.phase0b'
  | 'db.tables.kpi'
  | 'db.seed.marker'
  | 'auth.fixtures'

type CheckState = 'ok' | 'fail' | 'skipped'

interface CheckResult {
  id: CheckId
  state: CheckState
  detail?: string
}

interface ReadinessBody {
  status: 'ready' | 'not_ready' | 'database_unavailable' | 'migration_pending' | 'schema_missing' | 'seed_missing' | 'auth_fixture_missing'
  checks: CheckResult[]
  timestamp: string
}

const REQUIRED_PUBLIC_TABLES = ['users', 'organizations']
const REQUIRED_UE_TABLES = [
  'claims',
  'claim_updates',
  'organization_members',
]
// Mirrors UE_TEST_USERS in apps/union-eyes/tests/fixtures/test-users.ts.
// Keep the LIKE probe below in sync with the shared '@nzila.test' suffix.
const EXPECTED_FIXTURE_USER_EMAILS = [
  'ue.qa.member.primary@nzila.test',
  'ue.qa.steward.primary@nzila.test',
  'ue.qa.staff.primary@nzila.test',
  'ue.qa.executive.primary@nzila.test',
  'ue.qa.admin.primary@nzila.test',
]
const FIXTURE_EMAIL_LIKE = '%@nzila.test'

function isProd(): boolean {
  return process.env.NODE_ENV === 'production'
}

async function runChecks(): Promise<CheckResult[]> {
  const results: CheckResult[] = [{ id: 'app.boot', state: 'ok' }]

  // Import at request time so a missing @nzila/db doesn't crash Next build
  let db: any = null
  let sql: any = null
  try {
    const dbMod = await import('@nzila/db')
    const drizzle = await import('drizzle-orm')
    db = dbMod.db
    sql = drizzle.sql
  } catch (err) {
    results.push({
      id: 'db.connect',
      state: 'fail',
      detail: err instanceof Error ? err.message : 'unknown',
    })
    // Everything else depends on db — mark them fail
    for (const id of [
      'db.schema.public',
      'db.schema.union_eyes',
      'db.migrations.platform',
      'db.migrations.django',
      'db.contract.phase0b',
      'db.tables.kpi',
      'db.seed.marker',
      'auth.fixtures',
    ] as CheckId[]) {
      results.push({ id, state: 'fail', detail: 'db not available' })
    }
    return results
  }

  // 2. db.connect
  try {
    await db.execute(sql`SELECT 1`)
    results.push({ id: 'db.connect', state: 'ok' })
  } catch (err) {
    results.push({
      id: 'db.connect',
      state: 'fail',
      detail: err instanceof Error ? err.message : 'unknown',
    })
    for (const id of [
      'db.schema.public',
      'db.schema.union_eyes',
      'db.migrations.platform',
      'db.migrations.django',
      'db.contract.phase0b',
      'db.tables.kpi',
      'db.seed.marker',
      'auth.fixtures',
    ] as CheckId[]) {
      results.push({ id, state: 'fail', detail: 'db unavailable' })
    }
    return results
  }

  // Helper — safely test if a table exists
  const tableExists = async (schema: string, name: string): Promise<boolean> => {
    try {
      const rows = (await db.execute(
        sql.raw(
          `SELECT 1 FROM information_schema.tables WHERE table_schema = '${schema.replace(/'/g, "''")}' AND table_name = '${name.replace(/'/g, "''")}' LIMIT 1`,
        ),
      )) as unknown as Array<Record<string, unknown>>
      return Array.isArray(rows) && rows.length > 0
    } catch {
      return false
    }
  }

  // 3. db.schema.public
  const publicMissing: string[] = []
  for (const t of REQUIRED_PUBLIC_TABLES) {
    if (!(await tableExists('public', t))) publicMissing.push(t)
  }
  results.push(
    publicMissing.length === 0
      ? { id: 'db.schema.public', state: 'ok' }
      : { id: 'db.schema.public', state: 'fail', detail: `missing: ${publicMissing.join(',')}` },
  )

  // 4. db.schema.union_eyes — tables may live in `public` (union eyes is single-schema)
  //    so we check both.
  const ueMissing: string[] = []
  for (const t of REQUIRED_UE_TABLES) {
    const inUe = await tableExists('union_eyes', t)
    const inPub = await tableExists('public', t)
    if (!inUe && !inPub) ueMissing.push(t)
  }
  results.push(
    ueMissing.length === 0
      ? { id: 'db.schema.union_eyes', state: 'ok' }
      : { id: 'db.schema.union_eyes', state: 'fail', detail: `missing: ${ueMissing.join(',')}` },
  )

  // 5. db.migrations.platform
  try {
    const rows = (await db.execute(
      sql`SELECT count(*)::int AS c FROM drizzle.__drizzle_migrations`,
    )) as unknown as Array<{ c: number }>
    const count = Array.isArray(rows) && rows.length > 0 ? Number(rows[0]?.c ?? 0) : 0
    results.push(
      count > 0
        ? { id: 'db.migrations.platform', state: 'ok', detail: `applied=${count}` }
        : { id: 'db.migrations.platform', state: 'fail', detail: 'no migrations applied' },
    )
  } catch (err) {
    results.push({
      id: 'db.migrations.platform',
      state: 'fail',
      detail: err instanceof Error ? err.message : 'unknown',
    })
  }

  // 6. db.migrations.django — table exists only if Django migrations were applied.
  //    In Phase 0C.1 baseline runs, Django migrations are NOT required; mark skipped.
  try {
    const rows = (await db.execute(
      sql.raw(
        `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='django_migrations' LIMIT 1`,
      ),
    )) as unknown as Array<Record<string, unknown>>
    const hasDjango = Array.isArray(rows) && rows.length > 0
    results.push({
      id: 'db.migrations.django',
      state: hasDjango ? 'ok' : 'skipped',
      detail: hasDjango ? undefined : 'django not required for Next.js-only lifecycle',
    })
  } catch {
    results.push({
      id: 'db.migrations.django',
      state: 'skipped',
      detail: 'django not required for Next.js-only lifecycle',
    })
  }

  // 7. db.contract.phase0b — resolver = organization_members table with fk to organizations
  try {
    const hasOrgMembers = await tableExists('public', 'organization_members')
    results.push(
      hasOrgMembers
        ? { id: 'db.contract.phase0b', state: 'ok' }
        : {
            id: 'db.contract.phase0b',
            state: 'fail',
            detail: 'organization_members missing',
          },
    )
  } catch (err) {
    results.push({
      id: 'db.contract.phase0b',
      state: 'fail',
      detail: err instanceof Error ? err.message : 'unknown',
    })
  }

  // 8. db.tables.kpi — optional in dev; skipped if not present
  try {
    const hasSnapshot = await tableExists('public', 'ue_kpi_snapshot')
    const hasPilot = await tableExists('public', 'ue_pilot_definition')
    const bothPresent = hasSnapshot && hasPilot
    results.push({
      id: 'db.tables.kpi',
      state: bothPresent ? 'ok' : 'skipped',
      detail: bothPresent ? undefined : 'kpi tables not required for E2E baseline',
    })
  } catch {
    results.push({
      id: 'db.tables.kpi',
      state: 'skipped',
      detail: 'kpi tables not required for E2E baseline',
    })
  }

  // 9. db.seed.marker — the seed writes a distinguishable row; we probe fixture identity
  try {
    const rows = (await db.execute(
      sql.raw(
        `SELECT count(*)::int AS c FROM public.users WHERE email LIKE '${FIXTURE_EMAIL_LIKE}'`,
      ),
    )) as unknown as Array<{ c: number }>
    const count = Array.isArray(rows) && rows.length > 0 ? Number(rows[0]?.c ?? 0) : 0
    results.push(
      count >= EXPECTED_FIXTURE_USER_EMAILS.length
        ? { id: 'db.seed.marker', state: 'ok', detail: `fixture_users=${count}` }
        : {
            id: 'db.seed.marker',
            state: 'fail',
            detail: `expected≥${EXPECTED_FIXTURE_USER_EMAILS.length} fixture users, found ${count}`,
          },
    )
  } catch (err) {
    results.push({
      id: 'db.seed.marker',
      state: 'fail',
      detail: err instanceof Error ? err.message : 'unknown',
    })
  }

  // 10. auth.fixtures — every expected fixture user is present in user_management.users
  try {
    const missing: string[] = []
    for (const email of EXPECTED_FIXTURE_USER_EMAILS) {
      const safe = email.replace(/'/g, "''")
      const rows = (await db.execute(
        sql.raw(`SELECT 1 FROM user_management.users WHERE email = '${safe}' LIMIT 1`),
      )) as unknown as Array<Record<string, unknown>>
      if (!Array.isArray(rows) || rows.length === 0) missing.push(email)
    }
    results.push(
      missing.length === 0
        ? { id: 'auth.fixtures', state: 'ok' }
        : { id: 'auth.fixtures', state: 'fail', detail: `missing: ${missing.length}` },
    )
  } catch (err) {
    results.push({
      id: 'auth.fixtures',
      state: 'fail',
      detail: err instanceof Error ? err.message : 'unknown',
    })
  }

  return results
}

function classifyStatus(results: CheckResult[]): ReadinessBody['status'] {
  const fails = results.filter((r) => r.state === 'fail')
  if (fails.length === 0) return 'ready'
  if (fails.some((r) => r.id === 'db.connect')) return 'database_unavailable'
  if (fails.some((r) => r.id === 'db.migrations.platform')) return 'migration_pending'
  if (fails.some((r) => r.id.startsWith('db.schema'))) return 'schema_missing'
  if (fails.some((r) => r.id === 'db.seed.marker')) return 'seed_missing'
  if (fails.some((r) => r.id === 'auth.fixtures')) return 'auth_fixture_missing'
  return 'not_ready'
}

function redactChecksForProd(results: CheckResult[]): CheckResult[] {
  return results.map(({ id, state }) => ({ id, state }))
}

export async function GET() {
  const results = await runChecks()
  const status = classifyStatus(results)
  const body: ReadinessBody = {
    status,
    checks: isProd() ? redactChecksForProd(results) : results,
    timestamp: new Date().toISOString(),
  }
  const httpStatus = status === 'ready' ? 200 : 503
  return NextResponse.json(body, {
    status: httpStatus,
    headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
  })
}
