import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { authenticatedOrgBindingSql, type AuthenticatedOrgBinding } from '@nzila/platform-auth/org-binding'
import { appendCanonicalAuditLog } from '../../lib/audit/canonical-audit-chain'
import { persistAtomicAudit } from '../../lib/audit/atomic-audit'
import { listAuditEntries, readAuditEntry } from '../../lib/audit/audit-reader'
import { withCanonicalTenantScope } from '../../lib/db/canonical-transaction-scope'
import type { RLSTx } from '../../lib/db/with-rls-context'
import { readAuditTrail, summarizeAuditTrail } from '../../components/compliance/audit-trail-readers'
import { openNativeRuntimeFixture } from './native-runtime-fixture'
import { folder, root, type V2Plan } from './source'

const native = process.env.UE_V2_NATIVE_MANIFEST === '1' ? describe : describe.skip

const PYTHON_VERIFY = `
import json, sys
src = open(sys.argv[1], encoding="utf8").read().replace("from django.db import transaction", "transaction = None")
ns = {}
exec(compile(src, "services", "exec"), ns)
rows = json.loads(sys.stdin.buffer.read().decode("utf-8"))
prev = None
for index, row in enumerate(rows):
    expected = ns["compute_content_hash"](
        action=row["action"] or "", resource_type=row["resource_type"] or "",
        resource_id=str(row["resource_id"] or ""), user_id=str(row["user_id"] or ""),
        correlation_id=str(row["correlation_id"] or ""), details=row["details"], previous_hash=prev)
    if row["content_hash"] != expected or (row["previous_hash"] or None) != prev:
        print(json.dumps({"valid": False, "broken_at_index": index, "expected": expected, "actual": row["content_hash"], "previous": row["previous_hash"], "chainPrevious": prev, "details": row["details"], "userId": row["user_id"]})); sys.exit(0)
    prev = row["content_hash"]
print(json.dumps({"valid": True, "count": len(rows)}))
`

native('canonical V2 audit writer against real PostgreSQL (public.audit_logs)', () => {
  const plan: V2Plan = JSON.parse(
    readFileSync(path.join(folder, 'UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json'), 'utf8'),
  )
  let fixture: Awaited<ReturnType<typeof openNativeRuntimeFixture>>
  let owner: ReturnType<typeof postgres>
  let db: ReturnType<typeof drizzle>
  const orgA = randomUUID()
  const orgB = randomUUID()

  beforeAll(async () => {
    fixture = await openNativeRuntimeFixture(plan)
    // Owner-class connection (same local password as the owned fixture): this proves the writer's
    // SQL/chain semantics; tenant RLS grants are covered by the existing runtime matrix.
    const url = new URL(fixture.runtimeUrl)
    url.username = 'postgres'
    owner = postgres(url.toString(), { max: 10 })
    db = drizzle(owner)
    for (const id of [orgA, orgB])
      await fixture.seed.query(
        `INSERT INTO public.organizations
          (id,name,slug,organization_type,hierarchy_path,hierarchy_level,sectors,clc_affiliated,
           member_count,active_member_count,settings,features_enabled,status,remittance_day,created_at,updated_at)
         VALUES ($1::uuid,'Audit organization','ue-audit-'||$1::text,'local',ARRAY[]::text[],0,
           ARRAY[]::varchar[],false,0,0,'{}',ARRAY[]::text[],'active',15,now(),now())`,
        [id],
      )
  }, 600000)
  afterAll(async () => {
    await owner?.end({ timeout: 5 })
    if (fixture) await fixture.dispose()
  })

  const append = (organizationId: string, index: number) =>
    db.transaction((tx) =>
      appendCanonicalAuditLog(tx as never, {
        organizationId,
        action: 'entitlement_check_failed',
        resourceType: 'entitlement',
        userId: `actor-${index}`,
        ipAddress: index % 2 ? '203.0.113.9' : 'not-an-ip',
        details: { index, text: 'é😀"quoted"', nested: { b: 2, a: 1 } },
      }),
    )

  const verify = async (organizationId: string) => {
    const rows = await fixture.seed.query(
      `SELECT action,resource_type,resource_id,user_id,correlation_id,details,content_hash,previous_hash
       FROM public.audit_logs WHERE organization_id=$1 ORDER BY created_at`,
      [organizationId],
    )
    return JSON.parse(
      execFileSync(
        'python',
        [
          '-c',
          PYTHON_VERIFY,
          path.join(root, 'apps', 'union-eyes', 'backend', 'core', 'services.py'),
        ],
        { input: JSON.stringify(rows.rows), encoding: 'utf8' },
      ),
    ) as { valid: boolean; count?: number }
  }

  it('keeps a single verifiable per-organization chain under concurrent writers', async () => {
    await Promise.all([
      ...Array.from({ length: 12 }, (_, index) => append(orgA, index)),
      ...Array.from({ length: 5 }, (_, index) => append(orgB, index)),
    ])
    expect(await verify(orgA)).toEqual({ valid: true, count: 12 })
    expect(await verify(orgB)).toEqual({ valid: true, count: 5 })
    const heads = await fixture.seed.query(
      `SELECT count(*)::int AS n FROM public.audit_logs WHERE organization_id=$1 AND previous_hash IS NULL`,
      [orgA],
    )
    expect(heads.rows[0].n).toBe(1)
  }, 120000)

  it('stores only a valid inet and the canonical organization attribution', async () => {
    const rows = await fixture.seed.query(
      `SELECT DISTINCT host(ip_address) AS ip, organization_id FROM public.audit_logs WHERE organization_id=$1`,
      [orgA],
    )
    expect(rows.rows.map((row) => row.ip).sort()).toEqual(['203.0.113.9', null])
    expect(rows.rows.every((row) => row.organization_id === orgA)).toBe(true)
  })

  it('detects tampering with the Python verification rule', async () => {
    await fixture.seed.query(
      `UPDATE public.audit_logs SET details = details || '{"tampered":true}'::jsonb
       WHERE ctid = (SELECT ctid FROM public.audit_logs WHERE organization_id=$1 ORDER BY created_at OFFSET 3 LIMIT 1)`,
      [orgB],
    )
    expect((await verify(orgB)).valid).toBe(false)
    expect((await verify(orgA)).valid).toBe(true)
  })

  it('rolls the chain head back with a failed protected transaction', async () => {
    const before = await fixture.seed.query(
      `SELECT count(*)::int AS n FROM public.audit_logs WHERE organization_id=$1`,
      [orgA],
    )
    await expect(
      db.transaction(async (tx) => {
        await appendCanonicalAuditLog(tx as never, {
          organizationId: orgA,
          action: 'x',
          resourceType: 'y',
          details: {},
        })
        throw new Error('protected operation failed')
      }),
    ).rejects.toThrow('protected operation failed')
    const after = await fixture.seed.query(
      `SELECT count(*)::int AS n FROM public.audit_logs WHERE organization_id=$1`,
      [orgA],
    )
    expect(after.rows[0].n).toBe(before.rows[0].n)
    expect((await verify(orgA)).valid).toBe(true)
  })
})

native('compliance audit reads on the actual canonical tenant principal', () => {
  let fixture: Awaited<ReturnType<typeof openNativeRuntimeFixture>>
  let runtime: ReturnType<typeof postgres>
  const orgA = randomUUID(), orgB = randomUUID()
  const adminA = randomUUID(), adminB = randomUUID()
  const bindings = new Map<string, AuthenticatedOrgBinding>()
  const previousMode = process.env.UE_CANONICAL_BOOTSTRAP_V2
  const within = <T>(userId: string, work: (tx: RLSTx) => Promise<T>) =>
    drizzle(runtime).transaction(async tx => {
      const binding = bindings.get(userId)!
      await tx.execute(sql`SET LOCAL ROLE union_eyes_runtime`)
      await tx.execute(authenticatedOrgBindingSql(binding))
      return withCanonicalTenantScope(tx as never, binding, work)
    })

  beforeAll(async () => {
    process.env.UE_CANONICAL_BOOTSTRAP_V2 = '1'
    const plan: V2Plan = JSON.parse(readFileSync(path.join(folder, 'UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json'), 'utf8'))
    fixture = await openNativeRuntimeFixture(plan)
    runtime = postgres(fixture.runtimeUrl, { max: 2 })
    for (const [organizationId, userId] of [[orgA, adminA], [orgB, adminB]]) {
      await fixture.seed.query(`INSERT INTO public.organizations
        (id,name,slug,organization_type,hierarchy_path,hierarchy_level,sectors,clc_affiliated,
         member_count,active_member_count,settings,features_enabled,status,remittance_day,created_at,updated_at)
        VALUES ($1::uuid,'Audit reader test','audit-reader-'||$1::text,'local',ARRAY[]::text[],0,ARRAY[]::varchar[],false,
          0,0,'{}',ARRAY[]::text[],'active',15,now(),now())`, [organizationId])
      const sessionToken = 'synthetic-audit-session-' + randomUUID(), expiresAt = new Date(Date.now() + 3_600_000)
      bindings.set(userId, { organizationId, userId, role: 'admin', sessionToken, expiresAt, authority: 'pg-session' })
      await fixture.seed.query('INSERT INTO user_management.users(user_id,email,email_verified) VALUES ($1,$2,true)', [userId, `${userId}@example.invalid`])
      await fixture.seed.query("INSERT INTO user_management.organization_users(user_id,organization_id,role) VALUES ($1,$2,'admin')", [userId, organizationId])
      await fixture.seed.query(`INSERT INTO user_management.user_sessions(user_id,organization_id,session_token,session_token_hash,expires_at)
        VALUES ($1,$2,$3,$4,$5)`, [userId, organizationId, sessionToken, createHash('sha256').update(sessionToken).digest('hex'), expiresAt])
      await within(userId, tx => persistAtomicAudit(tx, {
        organizationId, userId, action: 'configuration.updated', resourceType: 'organization', resourceId: organizationId,
        ipAddress: '203.0.113.9', userAgent: 'private-synthetic-agent', details: { confidentialMemberContent: 'must-never-leave-the-ledger' },
      }))
    }
    // Model the retained legacy sink on a preserving installation. It has no
    // runtime grants, and must remain inaccessible after the reader repair.
    await fixture.seed.query(`CREATE SCHEMA IF NOT EXISTS audit_security;
      CREATE TABLE IF NOT EXISTS audit_security.audit_logs
        (audit_id uuid,organization_id uuid,action text,resource_type text,resource_id uuid,user_id text,
         severity text,outcome text,created_at timestamptz)`)
    await fixture.seed.query("INSERT INTO audit_security.audit_logs(audit_id,organization_id,action) VALUES ($1,$2,'legacy.must-not-be-backfilled')", [randomUUID(), orgA])
  }, 600_000)

  afterAll(async () => {
    try { await runtime?.end({ timeout: 5 }) } finally {
      try { await fixture?.dispose() } finally {
        if (previousMode === undefined) delete process.env.UE_CANONICAL_BOOTSTRAP_V2
        else process.env.UE_CANONICAL_BOOTSTRAP_V2 = previousMode
      }
    }
  })

  it('writes and reads the canonical ledger as a restricted, verified tenant and atomically audits that read', async () => {
    const rows = await within(adminA, async tx => {
      const [principal] = await tx.execute(sql`SELECT r.rolsuper,r.rolbypassrls,current_user::text AS actor
        FROM pg_roles r WHERE r.rolname=current_user`)
      expect(principal).toEqual({ rolsuper: false, rolbypassrls: false, actor: 'union_eyes_runtime' })
      const entries = await listAuditEntries(tx, orgA)
      await persistAtomicAudit(tx, { organizationId: orgA, userId: adminA, action: 'compliance.audit_log.read',
        resourceType: 'audit_logs', resourceId: orgA, details: { count: entries.length } })
      return entries
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ action: 'configuration.updated', source: 'canonical', severity: null, outcome: null, userId: adminA })
    expect(JSON.stringify(rows)).not.toMatch(/confidentialMemberContent|must-never|203\.0\.113|private-synthetic-agent|legacy\.must/)
    const parsed = readAuditTrail({ success: true, data: JSON.parse(JSON.stringify(rows)) })
    expect(summarizeAuditTrail(parsed)).toEqual({ total: 1, unsuccessful: 0, severe: 0 })
    const audit = await fixture.seed.query("SELECT user_id,details FROM public.audit_logs WHERE organization_id=$1 AND action='compliance.audit_log.read'", [orgA])
    expect(audit.rows).toEqual([{ user_id: adminA, details: { count: 1 } }])
  })

  it('a foreign organization parameter or foreign entry identifier cannot cross the verified tenant boundary', async () => {
    const foreign = await within(adminB, tx => listAuditEntries(tx, orgB))
    expect(foreign).toHaveLength(1)
    expect(await within(adminA, tx => listAuditEntries(tx, orgB))).toEqual([])
    expect(await within(adminA, tx => readAuditEntry(tx, orgB, foreign[0].auditId))).toBeNull()
    expect(await within(adminA, tx => readAuditEntry(tx, orgA, foreign[0].auditId))).toBeNull()
  })

  it('invented GUCs or a session binding for another organization do not confer audit access', async () => {
    await drizzle(runtime).transaction(async tx => {
      await tx.execute(sql`SET LOCAL ROLE union_eyes_runtime`)
      await tx.execute(sql`SELECT set_config('app.current_org_id',${orgA},true),set_config('app.current_user_id',${adminA},true)`)
      expect(await listAuditEntries(tx as never, orgA)).toEqual([])
    })
    const foreignBindingRows = await drizzle(runtime).transaction(async tx => {
      await tx.execute(sql`SET LOCAL ROLE union_eyes_runtime`)
      await tx.execute(authenticatedOrgBindingSql({ ...bindings.get(adminA)!, organizationId: orgB }))
      return listAuditEntries(tx as never, orgB)
    })
    expect(foreignBindingRows).toEqual([])
  })

  it('the retained legacy table still refuses runtime SELECT with 42501', async () => {
    await expect(within(adminA, tx => tx.execute(sql`SELECT audit_id FROM audit_security.audit_logs`)))
      .rejects.toMatchObject({ cause: { code: '42501' } })
    expect((await within(adminA, tx => listAuditEntries(tx, orgA))).some(row => row.action === 'configuration.updated')).toBe(true)
  })

  it('a mandatory read-audit failure rejects the response and leaves no partial audit record', async () => {
    const count = async () => Number((await fixture.seed.query("SELECT count(*)::int AS n FROM public.audit_logs WHERE organization_id=$1 AND action='compliance.audit_log.read'", [orgA])).rows[0].n)
    const before = await count()
    await fixture.seed.query(`CREATE FUNCTION public.ue_test_refuse_compliance_read() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.action='compliance.audit_log.read' THEN RAISE EXCEPTION 'controlled read-audit failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER ue_test_refuse_compliance_read BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.ue_test_refuse_compliance_read()`)
    try {
      await expect(within(adminA, async tx => {
        const entries = await listAuditEntries(tx, orgA)
        await persistAtomicAudit(tx, { organizationId: orgA, userId: adminA, action: 'compliance.audit_log.read',
          resourceType: 'audit_logs', resourceId: orgA, details: { count: entries.length } })
        return entries
      })).rejects.toMatchObject({ cause: { code: 'P0001', message: 'controlled read-audit failure' } })
      expect(await count()).toBe(before)
    } finally {
      await fixture.seed.query('DROP TRIGGER ue_test_refuse_compliance_read ON public.audit_logs; DROP FUNCTION public.ue_test_refuse_compliance_read()')
    }
  })
})
