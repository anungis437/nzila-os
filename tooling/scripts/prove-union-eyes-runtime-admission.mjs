#!/usr/bin/env node
/**
 * Disposable-database proof for release admission, serving drift, operations
 * reads, and the strike-fund deletion guard.
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

const evidence = []
function record(name, detail) {
  evidence.push({ name, ...detail })
  process.stdout.write(`${name} ${JSON.stringify(detail)}\n`)
}

const owner = new pg.Client({ connectionString })
await owner.connect()

async function asRole(role, sql, params = []) {
  const client = new pg.Client({ connectionString })
  await client.connect()
  try {
    await client.query('BEGIN')
    await client.query(`SET LOCAL ROLE ${role}`)
    const result = await client.query(sql, params)
    await client.query('ROLLBACK')
    return { ok: true, rows: result.rows, rowCount: result.rowCount }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    return { ok: false, error: error.message }
  } finally {
    await client.end()
  }
}

function admit(enforce = false, flag = false) {
  const args = [path.join(repoRoot, 'tooling/scripts/union-eyes-catalog-admission.mjs')]
  if (enforce) args.push('--enforce')
  const env = { ...process.env }
  if (flag) env.UE_PRIVILEGE_ENFORCEMENT = '1'
  else delete env.UE_PRIVILEGE_ENFORCEMENT
  return spawnSync(process.execPath, args, { cwd: repoRoot, env, encoding: 'utf8' })
}

function healthProbe() {
  return spawnSync(
    'pnpm',
    ['exec', 'tsx', path.join(repoRoot, 'apps/union-eyes/scripts/probe-health-admission.ts')],
    {
      cwd: path.join(repoRoot, 'apps/union-eyes'),
      env: {
        ...process.env,
        AUTH_SECRET: process.env.AUTH_SECRET || 'runtime-admission-probe',
        UE_ENVIRONMENT: 'disposable-pg16',
      },
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    },
  )
}

try {
  const guardSql = fs.readFileSync(
    path.join(repoRoot, 'apps/union-eyes/db/migrations-platform/0011_strike_fund_deletion_guard.sql'),
    'utf8',
  )
  await owner.query(guardSql)
  record('strike_guard_installed', { ok: true })

  const clean = admit(false)
  record('clean_admission', { status: clean.status, stderr: (clean.stderr || '').slice(0, 400) })
  if (clean.status !== 0) throw new Error(`clean database failed admission:\n${clean.stderr}`)

  await owner.query('DROP VIEW IF EXISTS public.ue_admission_bypass')
  await owner.query('DROP FUNCTION IF EXISTS public.ue_admission_definer()')
  await owner.query('REVOKE ue_excess FROM union_eyes_runtime').catch(() => {})
  await owner.query('DROP ROLE IF EXISTS ue_excess')
  await owner.query('CREATE ROLE ue_excess NOLOGIN')
  await owner.query('GRANT ue_excess TO union_eyes_runtime')
  await owner.query('GRANT SELECT ON TABLE public.platform_services TO PUBLIC')
  await owner.query(`
    CREATE OR REPLACE VIEW public.ue_admission_bypass AS
    SELECT service_name, status FROM public.platform_services
  `)
  await owner.query('GRANT SELECT ON public.ue_admission_bypass TO union_eyes_runtime')
  await owner.query(`
    CREATE OR REPLACE FUNCTION public.ue_admission_definer()
    RETURNS boolean
    LANGUAGE sql
    SECURITY DEFINER
    AS $$ SELECT true $$
  `)
  await owner.query('GRANT EXECUTE ON FUNCTION public.ue_admission_definer() TO union_eyes_runtime')
  await owner.query('DROP POLICY ue_org_isolation_select ON public.strike_fund_disbursements')

  const runtimeStillReads = await asRole(
    'union_eyes_runtime',
    'SELECT count(*)::int AS n FROM public.platform_services',
  )
  record('drift_preserves_effective_access', runtimeStillReads)

  const drifted = admit(false)
  record('drifted_admission', {
    status: drifted.status,
    diagnostic: (drifted.stderr || '').split('\n').slice(0, 12),
  })
  if (drifted.status === 0) throw new Error('drifted database was admitted')
  const diagnostic = drifted.stderr || ''
  for (const token of ['environment=', 'source=', 'union_eyes_runtime', 'PUBLIC holds SELECT on public.platform_services', 'ue_admission_bypass', 'ue_admission_definer', 'strike_fund_disbursements']) {
    if (!diagnostic.includes(token)) throw new Error(`diagnostic missing ${token}`)
  }

  const driftedHealth = healthProbe()
  record('drifted_health', {
    status: driftedHealth.status,
    stdout: (driftedHealth.stdout || '').slice(0, 2000),
    stderr: (driftedHealth.stderr || '').slice(0, 1500),
  })
  if (driftedHealth.status !== 0) throw new Error(`health probe failed to execute:\n${driftedHealth.stderr}\n${driftedHealth.stdout}`)
  const driftedBody = JSON.parse(driftedHealth.stdout.slice(driftedHealth.stdout.indexOf('{')))
  if (driftedBody.ok !== false || driftedBody.httpStatus !== 503 || driftedBody.admissionOk !== false) {
    throw new Error(`drifted health was admitted: ${driftedHealth.stdout}`)
  }
  const publicCatalog = JSON.stringify(driftedBody.catalog)
  if (driftedBody.catalog?.error !== 'catalog authority admission failed' || /PUBLIC holds|platform_services|inherits/.test(publicCatalog)) {
    throw new Error(`public health response exposed catalog detail: ${publicCatalog}`)
  }

  const refused = admit(true, false)
  record('enforce_without_flag', { status: refused.status, stderr: (refused.stderr || '').slice(0, 300) })
  if (refused.status === 0) throw new Error('enforcement ran without UE_PRIVILEGE_ENFORCEMENT=1')

  const repaired = admit(true, true)
  record('enforced_admission', { status: repaired.status, stderr: (repaired.stderr || '').slice(0, 800) })
  if (repaired.status !== 0) throw new Error(`enforcement did not restore admission:\n${repaired.stderr}`)

  const stillThere = await owner.query(`
    SELECT
      to_regclass('public.ue_admission_bypass') IS NOT NULL AS view_remains,
      has_table_privilege('union_eyes_runtime', 'public.platform_services', 'SELECT') AS runtime_select
  `)
  record('remediation_reversible_shape', stillThere.rows[0])

  const cleanHealth = healthProbe()
  record('restored_health', {
    status: cleanHealth.status,
    stdout: (cleanHealth.stdout || '').slice(0, 2000),
    stderr: (cleanHealth.stderr || '').slice(0, 800),
  })
  if (cleanHealth.status !== 0) throw new Error(`restored health probe failed:\n${cleanHealth.stderr}\n${cleanHealth.stdout}`)
  const cleanBody = JSON.parse(cleanHealth.stdout.slice(cleanHealth.stdout.indexOf('{')))
  if (cleanBody.ok !== true || cleanBody.httpStatus !== 200 || cleanBody.catalog?.status !== 'ok') {
    throw new Error(`restored health was not ready: ${cleanHealth.stdout}`)
  }
  if (cleanBody.applicationReady !== false) throw new Error('admission attested applicationReady')

  await owner.query(`DELETE FROM public.platform_services WHERE service_name LIKE 'ue-admission-%'`)
  await owner.query(`
    INSERT INTO public.platform_services (service_name, status, updated_at) VALUES
      ('ue-admission-api', 'down', now()),
      ('ue-admission-worker', 'degraded', now()),
      ('ue-admission-batch', 'unknown', now())
  `)
  const services = await asRole(
    'union_eyes_runtime',
    `SELECT service_name, status, updated_at
     FROM public.platform_services
     WHERE service_name LIKE 'ue-admission-%'
     ORDER BY service_name`,
  )
  const page = fs.readFileSync(
    path.join(repoRoot, 'apps/union-eyes/app/[locale]/dashboard/operations/page.tsx'),
    'utf8',
  )
  const healthy = (services.rows || []).filter((row) => row.status === 'healthy').length
  record('operations_read', {
    ...services,
    healthy,
    total: services.rowCount,
    pageQueriesMissingObjects: /uptime_pct|platform_incidents|platform_login_events|platform_sla_metrics|platform_releases|platform_capacity/.test(page),
  })
  if (!services.ok || healthy !== 0 || services.rowCount !== 3) {
    throw new Error('operations read did not preserve the stored statuses')
  }
  if (/uptime_pct|platform_incidents|platform_login_events|platform_sla_metrics|platform_releases|platform_capacity/.test(page)) {
    throw new Error('operations page still queries absent columns or tables')
  }
  const denied = await asRole('ue_excess', `SELECT service_name FROM public.platform_services`)
  record('operations_permission_denied', denied)
  if (denied.ok) throw new Error('a role without SELECT read platform_services')
  const missing = await asRole(
    'union_eyes_runtime',
    `SELECT count(*)::int AS n FROM public.platform_services WHERE service_name LIKE 'ue-admission-missing-%'`,
  )
  record('operations_missing_rows', missing)
  await owner.query(`DELETE FROM public.platform_services WHERE service_name LIKE 'ue-admission-%'`)

  const org = await owner.query(`
    INSERT INTO public.organizations (id, name, slug, organization_type, hierarchy_path)
    VALUES (gen_random_uuid(), 'Strike Guard Probe', 'strike-guard-probe', 'local', ARRAY['strike-guard-probe']::text[])
    RETURNING id
  `)
  const orgId = org.rows[0].id
  await owner.query(`
    INSERT INTO public.strike_fund_disbursements (
      user_id, organization_id, payment_date, payment_amount, payment_method,
      tax_year, tax_month, week_number, weekly_total, province
    ) VALUES (
      'strike-guard-user', $1, now(), 10.00, 'eft', '2026', '01', '1', 10.00, 'ON'
    )
  `, [orgId])
  let deleteRefused = false
  try {
    await owner.query('DELETE FROM public.organizations WHERE id = $1', [orgId])
  } catch (error) {
    deleteRefused = /strike_fund_disbursements history exists/.test(error.message)
    record('strike_delete_refused', { ok: deleteRefused, error: error.message })
  }
  if (!deleteRefused) throw new Error('organization delete erased or ignored strike-fund history')
  const remaining = await owner.query(
    'SELECT count(*)::int AS n FROM public.strike_fund_disbursements WHERE organization_id = $1',
    [orgId],
  )
  const deactivated = await owner.query(
    `UPDATE public.organizations SET status = 'inactive' WHERE id = $1 RETURNING status`,
    [orgId],
  )
  record('strike_deactivation', { status: deactivated.rows[0].status, disbursements: remaining.rows[0].n })
  if (deactivated.rows[0].status !== 'inactive' || remaining.rows[0].n !== 1) {
    throw new Error('deactivation did not preserve the disbursement')
  }
  await owner.query('DELETE FROM public.strike_fund_disbursements WHERE organization_id = $1', [orgId])
  await owner.query('DELETE FROM public.organizations WHERE id = $1', [orgId])
  record('strike_delete_without_history', { ok: true })

  const users = await asRole('union_eyes_runtime', 'SELECT count(*)::int AS n FROM user_management.users')
  const auditRead = await asRole('union_eyes_runtime', 'SELECT count(*)::int AS n FROM audit_security.audit_logs')
  const authAudit = await asRole('union_eyes_runtime', 'SELECT count(*)::int AS n FROM user_management.auth_audit_log')
  const drizzle = await asRole('union_eyes_runtime', 'SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations')
  record('restricted_schema_access', { users, auditRead, authAudit, drizzle })
  if (!users.ok) throw new Error('runtime SELECT on user_management.users was denied')
  if (auditRead.ok || authAudit.ok || drizzle.ok) {
    throw new Error('runtime read a schema outside its grant')
  }

  await owner.query('DROP VIEW IF EXISTS public.ue_admission_bypass')
  await owner.query('DROP FUNCTION IF EXISTS public.ue_admission_definer()')
  await owner.query('DROP ROLE IF EXISTS ue_excess')
  record('proof_complete', { ok: true })
} finally {
  await owner.end()
  fs.writeFileSync('/tmp/ue-runtime-admission-evidence.json', JSON.stringify(evidence, null, 2))
}
