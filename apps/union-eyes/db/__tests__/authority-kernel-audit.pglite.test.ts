/**
 * Transactional audit on PGlite: authority mutations and the canonical hash-chained
 * audit record live and die together, and the existing chain guarantees are
 * preserved. PGlite is single-connection, so concurrent and crash/retry behaviour
 * is proven on real PostgreSQL in the .postgres suite. Not a staging pass.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { newUuid, ORG, ORG_B, U } from './authority-kernel-harness'
import { daysAhead, freshDb, kit, minutesAgo } from './authority-kernel-testkit'
import { canonicalAuditContentHash } from '../../lib/audit/canonical-audit-chain'
import { auditAuthorityMutation, reconcileAuthorityAudit } from '../../lib/authority/store/audit'
import { runIdempotent } from '../../lib/authority/store/idempotency'
import { declareOwnRecusal } from '../../lib/authority/store/lifecycle'
import { insertRecusal } from '../../lib/authority/store/mutations'
import type { PGlite } from '@electric-sql/pglite'

let db: PGlite
let k: ReturnType<typeof kit>

const count = (sql: string, params: unknown[] = []) => k.asAdmin(async () => Number((await db.query<{ n: string }>(sql, params)).rows[0].n))
const recusals = () => count(`SELECT count(*)::text n FROM ue_authority_recusals`)
const audits = (like = 'authority.%') => count(`SELECT count(*)::text n FROM public.audit_logs WHERE action LIKE $1`, [like])
const events = () => count(`SELECT count(*)::text n FROM ue_authority_events`)
const recuse = (who = U.member) => k.as(who)((t) => declareOwnRecusal(t, { organizationId: ORG, principalUserId: who, resourceType: 'case', resourceId: newUuid(), reason: 'conflict of interest' }))

beforeAll(async () => {
  db = await freshDb()
  k = kit(db)
})

describe('mutation and canonical audit are one unit', () => {
  it('a successful operation writes its row, its event and ONE canonical audit row naming that event', async () => {
    const [r0, e0, a0] = [await recusals(), await events(), await audits()]
    await recuse()
    expect([await recusals(), await events(), await audits()]).toEqual([r0 + 1, e0 + 1, a0 + 1])
    const row = (await k.asAdmin(() => db.query<{ details: Record<string, unknown>; resource_type: string }>(`SELECT details, resource_type FROM public.audit_logs WHERE action = 'authority.recusal.declare' ORDER BY created_at DESC LIMIT 1`))).rows[0]
    const ev = (await k.asAdmin(() => db.query<{ id: string }>(`SELECT id::text id FROM ue_authority_events ORDER BY event_seq DESC LIMIT 1`))).rows[0].id
    expect(row.details.authorityEventIds).toEqual([ev])
    expect(row.resource_type).toBe('ue_authority_recusals')
  })

  it('when the AUDIT write fails, the business mutation is rolled back with it', async () => {
    await k.asAdmin(async () => {
      await db.exec(`CREATE FUNCTION ue_test_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.action = 'authority.recusal.declare' THEN RAISE EXCEPTION 'audit sink unavailable'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER ue_test_fail_audit BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION ue_test_fail_audit();`)
    })
    try {
      const [r0, e0, a0] = [await recusals(), await events(), await audits('%')]
      await expect(recuse()).rejects.toThrow(/audit sink unavailable/)
      expect([await recusals(), await events(), await audits('%')]).toEqual([r0, e0, a0])
    } finally {
      await k.asAdmin(() => db.exec(`DROP TRIGGER ue_test_fail_audit ON public.audit_logs; DROP FUNCTION ue_test_fail_audit()`))
    }
    await recuse() // and the operation works again once the sink recovers
  })

  it('when the MUTATION fails, no audit record is written', async () => {
    const [e0, a0] = [await events(), await audits('%')]
    await expect(k.as(U.member)((t) => insertRecusal(t, { organizationId: ORG, principalUserId: U.member, resourceType: 'case', resourceId: newUuid(), reason: '   ' }))).rejects.toThrow(/reason_chk/)
    expect([await events(), await audits('%')]).toEqual([e0, a0])
  })

  it('a later failure in the same transaction rolls back the audited mutation too', async () => {
    const [r0, e0, a0] = [await recusals(), await events(), await audits('%')]
    await expect(k.as(U.member)(async (t) => {
      await insertRecusal(t, { organizationId: ORG, principalUserId: U.member, resourceType: 'case', resourceId: newUuid(), reason: 'ok' })
      throw new Error('downstream failure after the audit write')
    })).rejects.toThrow(/downstream failure/)
    expect([await recusals(), await events(), await audits('%')]).toEqual([r0, e0, a0])
  })

  it('COMMIT is refused when no canonical audit record names the event (even for an administrator)', async () => {
    const [r0, e0] = [await recusals(), await events()]
    await expect(k.as(U.member)((t) => t.query(`INSERT INTO ue_authority_recusals (organization_id, principal_user_id, resource_type, resource_id, reason) VALUES ($1,$2,'case',$3,'sneaky')`, [ORG, U.member, newUuid()]))).rejects.toThrow(/AUDIT_LINK_MISSING/)
    await k.asAdmin(async () => {
      await expect(db.query(`UPDATE ue_authority_recusals SET reason = reason WHERE false`)).resolves.toBeTruthy()
      await expect(db.query(`INSERT INTO ue_authority_recusals (organization_id, principal_user_id, resource_type, resource_id, reason) VALUES ($1,$2,'case',$3,'admin')`, [ORG, U.member, newUuid()])).rejects.toThrow(/AUDIT_LINK_MISSING/)
    })
    expect([await recusals(), await events()]).toEqual([r0, e0])
  })

  it('an unrelated audit row cannot satisfy the link: it must name this event, be an authority action, and be in this organization', async () => {
    const insertAudit = (t: { query: (s: string, p?: unknown[]) => Promise<unknown> }, action: string, org: string, ids: string[]) =>
      t.query(`INSERT INTO public.audit_logs (id, audit_id, created_at, updated_at, organization_id, action, resource_type, details)
               VALUES (gen_random_uuid(), gen_random_uuid(), clock_timestamp(), clock_timestamp(), $1, $2, 'x', $3::jsonb)`, [org, action, JSON.stringify({ authorityEventIds: ids })])
    const attempt = (action: string, mutateIds: (id: string) => string[]) => k.as(U.member)(async (t) => {
      await t.query(`INSERT INTO ue_authority_recusals (organization_id, principal_user_id, resource_type, resource_id, reason) VALUES ($1,$2,'case',$3,'forge')`, [ORG, U.member, newUuid()])
      const id = (await t.query<{ id: string }>(`SELECT id::text id FROM ue_authority_events WHERE txid = txid_current() ORDER BY event_seq DESC LIMIT 1`)).rows[0].id
      await insertAudit(t, action, ORG, mutateIds(id))
    })
    await expect(attempt('authority.recusal.declare', () => [newUuid()])).rejects.toThrow(/AUDIT_LINK_MISSING/) // wrong event id
    await expect(attempt('user.login', (id) => [id])).rejects.toThrow(/AUDIT_LINK_MISSING/) // not an authority action
    await expect(attempt('authority.recusal.declare', () => [])).rejects.toThrow(/AUDIT_LINK_MISSING/)
    // A row in another organization is invisible (RLS) and cannot even be written from this one.
    await expect(k.as(U.member)(async (t) => {
      await t.query(`INSERT INTO ue_authority_recusals (organization_id, principal_user_id, resource_type, resource_id, reason) VALUES ($1,$2,'case',$3,'forge')`, [ORG, U.member, newUuid()])
      await insertAudit(t, 'authority.recusal.declare', ORG_B, ['x'])
    })).rejects.toThrow(/row-level security|AUDIT_LINK_MISSING/)
  })

  it('an operation that produced no event writes no audit row', async () => {
    const a0 = await audits('%')
    const ids = await k.as(U.member)((t) => auditAuthorityMutation(t, { organizationId: ORG, action: 'noop', resourceType: 'none' }))
    expect(ids).toEqual([])
    expect(await audits('%')).toBe(a0)
  })
})

describe('the canonical chain guarantees are preserved', () => {
  it('every authority audit row extends the organization’s hash chain exactly as the existing verifier recomputes it', async () => {
    for (let i = 0; i < 4; i++) await recuse()
    const rows = (await k.asAdmin(() => db.query<{ action: string; resource_type: string; resource_id: string | null; user_id: string | null; details: Record<string, unknown>; content_hash: string; previous_hash: string | null }>(
      `SELECT action, resource_type, resource_id, user_id, details, content_hash, previous_hash FROM public.audit_logs WHERE organization_id = $1 ORDER BY created_at, id`, [ORG]))).rows
    expect(rows.length).toBeGreaterThan(4)
    let prev: string | null = null
    for (const r of rows) {
      expect(r.previous_hash).toBe(prev)
      expect(r.content_hash).toBe(canonicalAuditContentHash({ action: r.action, resourceType: r.resource_type, resourceId: r.resource_id ?? '', userId: r.user_id ?? '', correlationId: '', details: r.details, previousHash: r.previous_hash }))
      prev = r.content_hash
    }
    expect(rows.length).toBeGreaterThan(0)
  })

  it('each audit row records the actor, the transaction and the policy version', async () => {
    const row = (await k.asAdmin(() => db.query<{ user_id: string; details: { authorityTxid: string; policyVersion: string } }>(`SELECT user_id, details FROM public.audit_logs WHERE action = 'authority.recusal.declare' ORDER BY created_at DESC LIMIT 1`))).rows[0]
    expect(row.user_id).toBe(U.member)
    expect(row.details.policyVersion).toMatch(/^ue-authority-kernel\//)
    expect(Number(row.details.authorityTxid)).toBeGreaterThan(0)
  })

  it('reconciliation is clean for a healthy organization', async () => {
    const r = await k.as(U.president)((t) => reconcileAuthorityAudit(t, ORG))
    expect(r).toEqual({ eventsWithoutAudit: [], auditRowsWithUnknownEvents: [], chainBreaks: [] })
  })

  it('reconciliation detects a deleted audit row, a forged reference and a broken chain', async () => {
    await recuse(U.member2)
    const victim = (await k.asAdmin(() => db.query<{ id: string }>(`SELECT id::text id FROM public.audit_logs WHERE action = 'authority.recusal.declare' ORDER BY created_at LIMIT 1`))).rows[0].id
    await k.asAdmin(() => db.query(`DELETE FROM public.audit_logs WHERE id = $1`, [victim]))
    let r = await k.as(U.president)((t) => reconcileAuthorityAudit(t, ORG))
    expect(r.eventsWithoutAudit.length).toBeGreaterThan(0)
    expect(r.chainBreaks.length).toBeGreaterThan(0)
    await k.asAdmin(() => db.query(`INSERT INTO public.audit_logs (id, audit_id, created_at, updated_at, organization_id, action, resource_type, details)
      VALUES (gen_random_uuid(), gen_random_uuid(), now(), now(), $1, 'authority.fake', 'x', $2::jsonb)`, [ORG, JSON.stringify({ authorityEventIds: [newUuid()] })]))
    r = await k.as(U.president)((t) => reconcileAuthorityAudit(t, ORG))
    expect(r.auditRowsWithUnknownEvents.length).toBe(1)
  })
})

describe('duplicate requests', () => {
  const run = (key: string, over: Record<string, unknown> = {}, fn?: () => Promise<Record<string, unknown>>) =>
    k.as(U.officer)((t) => runIdempotent(t, { organizationId: ORG, actorUserId: U.officer, key, operation: 'recusal.declare', payload: { resource: 'r1', ...over } },
      fn ?? (async () => ({ recusalId: await insertRecusal(t, { organizationId: ORG, principalUserId: U.officer, resourceType: 'case', resourceId: newUuid(), reason: 'conflict' }) }))))

  it('a duplicate runs once, writes one audit row, and replays the stored result', async () => {
    const [r0, a0] = [await recusals(), await audits()]
    const first = await run('dup-key-0001')
    const second = await run('dup-key-0001')
    expect(first.replayed).toBe(false)
    expect(second.replayed).toBe(true)
    expect(second.result).toEqual(first.result)
    expect([await recusals(), await audits()]).toEqual([r0 + 1, a0 + 1])
  })

  it('reusing a key for a different request is refused, never silently replayed', async () => {
    await run('dup-key-0002')
    await expect(run('dup-key-0002', { resource: 'r2' })).rejects.toThrow(/different request/)
  })

  it('a failed attempt leaves no idempotency record, so the retry executes', async () => {
    await expect(run('dup-key-0003', {}, async () => { throw new Error('crash mid-operation') })).rejects.toThrow(/crash mid-operation/)
    expect(await count(`SELECT count(*)::text n FROM ue_authority_requests WHERE idempotency_key = 'dup-key-0003'`)).toBe(0)
    const retry = await run('dup-key-0003')
    expect(retry.replayed).toBe(false)
  })

  it('keys are per organization', async () => {
    await run('shared-key-01')
    await expect(k.as(U.president, ORG_B)((t) => runIdempotent(t, { organizationId: ORG_B, actorUserId: U.president, key: 'shared-key-01', operation: 'x', payload: {} }, async () => ({ ok: true })))).resolves.toMatchObject({ replayed: false })
  })

  it('weak or oversized keys and a rewritten result are refused by the database', async () => {
    await expect(run('short')).rejects.toThrow(/key_chk/)
    await expect(run('x'.repeat(201))).rejects.toThrow(/key_chk/)
    await expect(k.as(U.officer)((t) => t.query(`UPDATE ue_authority_requests SET result = '{"tampered":true}'::jsonb WHERE idempotency_key = 'dup-key-0001'`))).rejects.toThrow(/only receive its result once/)
  })
})
