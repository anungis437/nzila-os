import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { appendCanonicalAuditLog, appendCanonicalPlatformAuditLog } from '../../lib/audit/canonical-audit-chain'
import { auditPartitions, inspectAuditPartition, sealAuditPartition } from '../../lib/audit/daily-audit-seal-store'
import { DAILY_AUDIT_SEAL_ACTION, auditSealKeyFingerprint } from '../../lib/audit/daily-audit-seal'
import { openNativeRuntimeFixture } from './native-runtime-fixture'
import { folder, type V2Plan } from './source'
import { readLatestReminderReceipt, readReminderHealth } from '../../lib/operations/reminder-health'

const native = process.env.UE_V2_NATIVE_MANIFEST === '1' ? describe : describe.skip
native('daily audit seal on the actual canonical PostgreSQL schema and roles', () => {
  let fixture: Awaited<ReturnType<typeof openNativeRuntimeFixture>>
  let systemSql: ReturnType<typeof postgres>
  let tenantSql: ReturnType<typeof postgres>
  const orgA = randomUUID(), orgB = randomUUID()
  const key = 'synthetic-native-daily-audit-seal-key-123456'
  const keys = new Map([[auditSealKeyFingerprint(key), key]])
  const sourceSha = 'a'.repeat(40)
  const system = <T>(work: (tx: Parameters<typeof sealAuditPartition>[0]) => Promise<T>) =>
    drizzle(systemSql).transaction(async tx => {
      await tx.execute(sql`SET LOCAL ROLE union_eyes_system`)
      return work(tx as never)
    })
  beforeAll(async () => {
    const plan: V2Plan = JSON.parse(readFileSync(path.join(folder, 'UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json'), 'utf8'))
    fixture = await openNativeRuntimeFixture(plan)
    systemSql = postgres(fixture.systemUrl, { max: 5 })
    tenantSql = postgres(fixture.runtimeUrl, { max: 1 })
    for (const id of [orgA, orgB]) await fixture.seed.query(`INSERT INTO public.organizations
      (id,name,slug,organization_type,hierarchy_path,hierarchy_level,sectors,clc_affiliated,
       member_count,active_member_count,settings,features_enabled,status,remittance_day,created_at,updated_at)
      VALUES ($1::uuid,'Audit test','seal-'||$1::text,'local',ARRAY[]::text[],0,ARRAY[]::varchar[],false,0,0,
        '{}',ARRAY[]::text[],'active',15,now(),now())`, [id])
    for (const organizationId of [orgA, orgB]) await system(tx => appendCanonicalAuditLog(tx, {
      organizationId, action: 'case.created', resourceType: 'claim', details: { text: 'é😀', synthetic: true },
    }))
  }, 600_000)
  afterAll(async () => {
    await Promise.allSettled([systemSql?.end({ timeout: 5 }), tenantSql?.end({ timeout: 5 })])
    await fixture?.dispose()
  })

  it('commits one durable checkpoint under concurrent retries and preserves the same identity after retry', async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => system(tx => sealAuditPartition(tx, { organizationId: orgA, key, sourceSha }))))
    expect(results.filter(result => result.created)).toHaveLength(1)
    expect(new Set(results.map(result => result.recordId)).size).toBe(1)
    const rows = await fixture.seed.query('SELECT count(*)::int AS n FROM public.audit_logs WHERE organization_id=$1 AND action=$2', [orgA, DAILY_AUDIT_SEAL_ACTION])
    expect(rows.rows[0].n).toBe(1)
    const inspected = await system(tx => inspectAuditPartition(tx, orgA, keys))
    expect(inspected.prefix.coveredEntryCount).toBe(2)
    expect(inspected.latestSeal?.id).toBe(results[0].recordId)
  }, 120_000)

  it('rolls the checkpoint back with its transaction, then permits a real retry', async () => {
    await expect(system(async tx => {
      await sealAuditPartition(tx, { organizationId: orgB, key, sourceSha })
      throw new Error('controlled rollback')
    })).rejects.toThrow('controlled rollback')
    const before = await system(tx => inspectAuditPartition(tx, orgB, keys))
    expect(before.latestSeal).toBeNull()
    expect(before.prefix.coveredEntryCount).toBe(1)
    expect((await system(tx => sealAuditPartition(tx, { organizationId: orgB, key, sourceSha }))).created).toBe(true)
  })

  it('cannot report success when the real checkpoint INSERT fails', async () => {
    await fixture.seed.query(`CREATE FUNCTION public.ue_test_refuse_checkpoint() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.action = '${DAILY_AUDIT_SEAL_ACTION}' AND NEW.organization_id IS NULL THEN
        RAISE EXCEPTION 'controlled checkpoint insert failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER ue_test_refuse_checkpoint BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.ue_test_refuse_checkpoint()`)
    try {
      await expect(system(tx => sealAuditPartition(tx, { organizationId: null, key, sourceSha }))).rejects.toThrow()
      const rows = await fixture.seed.query('SELECT count(*)::int AS n FROM public.audit_logs WHERE organization_id IS NULL')
      expect(rows.rows[0].n).toBe(0)
    } finally {
      await fixture.seed.query('DROP TRIGGER ue_test_refuse_checkpoint ON public.audit_logs; DROP FUNCTION public.ue_test_refuse_checkpoint()')
    }
    await system(tx => appendCanonicalPlatformAuditLog(tx, { action: 'worker.completed', resourceType: 'cron', details: { synthetic: true } }))
    expect((await system(tx => sealAuditPartition(tx, { organizationId: null, key, sourceSha }))).created).toBe(true)
    expect((await system(tx => auditPartitions(tx))).sort()).toEqual([null, orgA, orgB].sort())
  })

  it('denies forged organization context, platform insertion and SYSTEM escalation on the real tenant connection', async () => {
    await drizzle(tenantSql).transaction(async tx => {
      await tx.execute(sql`SET LOCAL ROLE union_eyes_runtime`)
      await tx.execute(sql`SELECT set_config('app.current_org_id', ${orgA}, true)`)
      const rows = await tx.execute<{ organization_id: string }>(sql`SELECT organization_id::text FROM public.audit_logs`)
      // A GUC alone is not a verified business session. The existing
      // restrictive session policy must deny even the invented own-org read.
      expect(rows).toHaveLength(0)
    })
    await expect(drizzle(tenantSql).transaction(async tx => {
      await tx.execute(sql`SET LOCAL ROLE union_eyes_runtime`)
      await tx.execute(sql`SELECT set_config('app.current_org_id', ${orgA}, true)`)
      await appendCanonicalPlatformAuditLog(tx as never, { action: 'forged', resourceType: 'cron', details: {} })
    })).rejects.toThrow()
    await expect(drizzle(tenantSql).transaction(tx => tx.execute(sql`SET LOCAL ROLE union_eyes_system`))).rejects.toThrow()
  })

  it('detects an altered non-content-hash field using the actual persisted checkpoint', async () => {
    await fixture.seed.query(`UPDATE public.audit_logs SET changes='{"forged":true}'::jsonb
      WHERE organization_id=$1 AND action='case.created'`, [orgB])
    await expect(system(tx => inspectAuditPartition(tx, orgB, keys))).rejects.toThrow('PREFIX_INVALID')
    expect((await system(tx => inspectAuditPartition(tx, orgA, keys))).latestSeal).not.toBeNull()
    await expect(system(tx => sealAuditPartition(tx, { organizationId: orgB, key, sourceSha }))).rejects.toThrow('PREFIX_INVALID')
  })

  it('reads the real reminder health columns using only existing SYSTEM grants', async () => {
    const health = await system(tx => readReminderHealth(tx))
    expect(health).toMatchObject({ state: 'ok', stalePending: 0, expiredClaims: 0, recentDeadLetters: 0 })
    expect(await system(tx => readLatestReminderReceipt(tx))).toBeUndefined()
    // This is an empty disposable queue proof, not a staged delivery claim.
  })
})
