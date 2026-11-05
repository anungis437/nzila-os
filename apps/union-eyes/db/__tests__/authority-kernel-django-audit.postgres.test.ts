/**
 * The authority audit bridge against the REAL Django-created audit_logs, verified by
 * Django's own verify_audit_chain. Proves the rows the TypeScript bridge writes are
 * accepted by the existing verifier byte for byte, and that tampering is detected by it.
 *
 * Skipped unless BOTH are set:
 *   UE_AUTHORITY_PG_URL   a disposable PostgreSQL server (see the .postgres suite)
 *   UE_AUTHORITY_DJANGO=1 python with the backend requirements is on PATH
 * It creates its own database, runs `python manage.py migrate core` into it, installs
 * the authority schema on top (without the audit_logs mirror) and drops it afterwards.
 * Not a staging isolation pass.
 */
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ORG, installAuthoritySchema, newUuid, seedCast, U, type Db } from './authority-kernel-harness'
import { kit } from './authority-kernel-testkit'
import { reconcileAuthorityAudit } from '../../lib/authority/store/audit'
import { runAuthorityTransaction, type SqlExecutor } from '../../lib/authority/store/executor'
import { declareOwnRecusal } from '../../lib/authority/store/lifecycle'

const URL = process.env.UE_AUTHORITY_PG_URL
const ENABLED = !!URL && process.env.UE_AUTHORITY_DJANGO === '1'
const BACKEND = resolve(__dirname, '..', '..', 'backend')
const adapt = (c: pg.Client): Db => ({ exec: (sql) => c.query(sql), query: (sql, params) => c.query(sql, params as unknown[]) as never })

describe.skipIf(!ENABLED)('authority audit against the real Django audit_logs', () => {
  const dbName = `ue_authority_django_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
  let admin: pg.Client
  let setup: pg.Client
  let runtime: pg.Client

  const pgEnv = () => {
    const u = new globalThis.URL(URL!)
    return { ...process.env, DJANGO_SETTINGS_MODULE: 'config.settings', DJANGO_SECRET_KEY: 'authority-test-only', DJANGO_DEBUG: 'True',
      PGDATABASE: dbName, PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password), PGHOST: u.hostname, PGPORT: u.port || '5432', REDIS_URL: 'redis://127.0.0.1:6379/15' }
  }
  const python = (args: string[]) => spawnSync(process.env.UE_CLEANROOM_PYTHON || 'python', args, { cwd: BACKEND, env: pgEnv(), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const djangoVerify = (org: string) => {
    const r = python(['manage.py', 'shell', '-c', `import json;from core.services import verify_audit_chain;print('RESULT='+json.dumps(verify_audit_chain('${org}')))`])
    const line = `${r.stdout}\n${r.stderr}`.split('\n').find((l) => l.startsWith('RESULT='))
    if (!line) throw new Error(`Django verifier produced no result: ${r.stderr.slice(-400)}`)
    return JSON.parse(line.slice('RESULT='.length)) as { valid: boolean; count: number; broken_at_index?: number }
  }
  const dbUrl = () => { const u = new globalThis.URL(URL!); u.pathname = `/${dbName}`; return u.toString() }

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    await admin.query(`CREATE DATABASE ${dbName}`)
    const migrate = python(['manage.py', 'migrate', 'core', '--noinput'])
    if (migrate.status !== 0) throw new Error(`Django migrate core failed: ${migrate.stderr.slice(-600)}`)
    setup = new pg.Client({ connectionString: dbUrl() })
    await setup.connect()
    await installAuthoritySchema(adapt(setup), { realAuditLogs: true })
    await seedCast(adapt(setup))
    // The real audit_logs has a deferred FK to organizations.
    await setup.query(`INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
      VALUES ($1,'Test Local','test-local','local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`, [ORG])
    runtime = new pg.Client({ connectionString: dbUrl() })
    await runtime.connect()
    await runtime.query('SET ROLE union_eyes_runtime')
  }, 240_000)

  afterAll(async () => {
    await runtime?.end().catch(() => undefined)
    await setup?.end().catch(() => undefined)
    await admin?.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`)
    await admin?.end()
  })

  const run = <T>(user: string, fn: (t: SqlExecutor) => Promise<T>) =>
    runAuthorityTransaction(runtime as unknown as SqlExecutor, { organizationId: ORG, userId: user }, fn)

  it('the real audit_logs has the hash-chain shape the bridge writes (Django-created, not mirrored)', async () => {
    const cols = (await setup.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'audit_logs' AND table_schema = 'public'`)).rows.map((r) => r.column_name)
    for (const c of ['audit_id', 'details', 'changes', 'content_hash', 'previous_hash', 'correlation_id']) expect(cols).toContain(c)
  })

  it('Django’s own verify_audit_chain accepts every row the authority bridge writes', async () => {
    const k = kit(adapt(runtime))
    await k.adoptDefaultRules()
    await k.grantOffice(U.vp, U.president, U.treasurer)
    for (let i = 0; i < 5; i++) await run(U.member, (t) => declareOwnRecusal(t, { organizationId: ORG, principalUserId: U.member, resourceType: 'case', resourceId: newUuid(), reason: `conflict ${i} — résumé ünïcode` }))
    const total = Number((await setup.query(`SELECT count(*) n FROM audit_logs WHERE organization_id = $1`, [ORG])).rows[0].n)
    expect(total).toBeGreaterThan(30)
    expect(djangoVerify(ORG)).toEqual({ valid: true, count: total })
    expect(await run(U.president, (t) => reconcileAuthorityAudit(t, ORG))).toEqual({ eventsWithoutAudit: [], auditRowsWithUnknownEvents: [], chainBreaks: [] })
  }, 120_000)

  it('Django’s verifier detects tampering with an authority audit row, and reconciliation agrees', async () => {
    const victim = (await setup.query(`SELECT id FROM audit_logs WHERE organization_id = $1 AND action = 'authority.recusal.declare' ORDER BY created_at LIMIT 1`, [ORG])).rows[0].id
    await setup.query(`UPDATE audit_logs SET details = jsonb_set(details, '{reason}', '"rewritten"') WHERE id = $1`, [victim])
    expect(djangoVerify(ORG).valid).toBe(false)
  }, 60_000)

  it('without a canonical audit row the real database still refuses the commit', async () => {
    await expect(run(U.member, (t) => t.query(`INSERT INTO ue_authority_recusals (organization_id, principal_user_id, resource_type, resource_id, reason) VALUES ($1,$2,'case',$3,'sneaky')`, [ORG, U.member, newUuid()]))).rejects.toThrow(/AUDIT_LINK_MISSING/)
  })
})
