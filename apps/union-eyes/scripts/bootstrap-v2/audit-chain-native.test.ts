import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { appendCanonicalAuditLog } from '../../lib/audit/canonical-audit-chain'
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
