/**
 * Durable inbound integration execution on real PostgreSQL, as the tenant runtime role under FORCE row-level security
 * (INT-01..16; platform 0090, scoped 0063, lib/integrations/inbound).
 *
 * What it holds:
 *   - a valid delivery commits one case, one identity link, one mandatory audit, one completed receipt (the id returned)
 *     and one pending outbox event, together;
 *   - the claim is a unique scoped key: concurrent workers on one key produce exactly one domain effect, and a replay
 *     returns the persisted receipt and status, never a new effect or an unrecorded success;
 *   - a malformed or drifted delivery is rejected with a durable receipt and nothing else; a conflicting, stale or unlinked
 *     identity is quarantined with a reason; failure detail carries no payload value;
 *   - an audit fault rolls the case back and leaves a retryable failed receipt; a claim whose worker died is recovered
 *     after its lease, by one of two racing workers, and a worker whose lease was taken over cannot complete;
 *   - another organization's source is invisible, the same external id elsewhere is another case, and a revoked source
 *     takes no new work (at the database too) while what it imported stays;
 *   - events are published only for committed receipts, once.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { serializeRawDates } from '@/db/driver-dates'
import { installNativeBusinessContext, withNativeCanonicalActor } from '../../scripts/runtime/native-canonical-fixture'
import { seedDeclaredCanonicalActor } from './native-declared-actor'

const URL = process.env.UE_AUTHORITY_COMBINED_URL

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }))
vi.mock('@/db/db', () => ({ db: {} }))

const inbound = URL ? await import('@/lib/integrations/inbound') : null

/** Drizzle wraps a database error ("Failed query: ..."); the database's own message is in its cause. */
async function expectRefused(work: Promise<unknown>, pattern?: RegExp) {
  const error = await work.then(() => undefined, (e: unknown) => e)
  expect(error, 'expected the database to refuse').toBeDefined()
  if (!pattern) return
  const messages: string[] = []
  for (let current = error as { message?: string; cause?: unknown } | undefined, d = 0; current && d < 6; d += 1) {
    messages.push(String(current.message ?? ''))
    current = current.cause as typeof current
  }
  expect(messages.join(' | ')).toMatch(pattern)
}

const SOURCE = 'legacy-cms'
const SCHEMA = 'v1'
const RULE = {
  name: 'legacy case', sourceEntityType: 'legacy_case', targetEntityType: 'case',
  fields: [
    { sourceField: 'id', targetField: 'externalCaseId', operation: 'rename', config: {}, required: true },
    { sourceField: 'subject', targetField: 'title', operation: 'rename', config: {}, required: true },
    { sourceField: 'body', targetField: 'description', operation: 'rename', config: {}, required: true },
    { sourceField: 'kind', targetField: 'type', operation: 'rename', config: {}, required: true },
    { sourceField: 'urgency', targetField: 'priority', operation: 'rename', config: {}, required: true },
    { sourceField: 'opened', targetField: 'filedDate', operation: 'rename', config: {}, required: true },
    { sourceField: 'member', targetField: 'memberExternalId', operation: 'rename', config: {}, required: false },
  ],
} as const

describe.skipIf(!URL)('durable inbound integration over the real case, receipt, link, audit and outbox tables', () => {
  const sfx = randomUUID().slice(0, 8)
  const ORG = randomUUID()
  const OTHER = randomUUID()
  const ADMIN = `inbound-admin-${sfx}`
  let admin: pg.Client
  let client: ReturnType<typeof postgres>
  let inTenantTx: import('@/lib/integrations/inbound').InTenantTx

  const payload = (id: string, extra: Record<string, unknown> = {}) => ({
    id, subject: `Case ${id}`, body: `Body of ${id}`, kind: 'contract', urgency: 'high', opened: '2026-01-10', ...extra,
  })
  const delivery = (organizationId: string, key: string, body: Record<string, unknown>, sourceSchemaVersion = SCHEMA) =>
    ({ organizationId, sourceKey: SOURCE, idempotencyKey: key, sourceSchemaVersion, payload: body })
  const executor = (options: Partial<import('@/lib/integrations/inbound').DurableInboundOptions> = {}) =>
    new inbound!.DurableInboundCaseExecutor({ inTenantTx, ...options })
  const one = async (query: string, params: unknown[] = []) => (await admin.query(query, params)).rows[0]
  const count = async (query: string, params: unknown[] = []) => Number((await admin.query(query, params)).rows[0].n)
  const cases = (org: string, externalId: string) =>
    count(`SELECT count(*)::int n FROM grievances WHERE organization_id = $1 AND source_system = $2 AND external_case_id = $3`, [org, SOURCE, externalId])
  const audits = (org: string, action: string, receiptId: string) =>
    count(`SELECT count(*)::int n FROM public.audit_logs WHERE organization_id = $1 AND action = $2 AND details->>'receiptId' = $3`, [org, action, receiptId])
  const outbox = (receiptId: string) => count(`SELECT count(*)::int n FROM ue_integration_outbox WHERE receipt_id = $1`, [receiptId])
  const receipt = (id: string) => one(`SELECT status, attempts, retryable, reason_code, reason_detail, mapping_version, case_id::text, effect FROM ue_integration_inbound_receipts WHERE id = $1`, [id])
  const expectReceipt = (outcome: unknown) => {
    expect(outcome).toMatchObject({ kind: 'receipt', persisted: true })
    return outcome as Extract<import('@/lib/integrations/inbound').InboundOutcome, { kind: 'receipt' }>
  }

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    client = postgres(URL!, { max: 10, onnotice: () => undefined })
    const db = drizzle(client)
    serializeRawDates(client)
    inTenantTx = (organizationId, work) =>
      withNativeCanonicalActor(ADMIN, organizationId, (binding) => db.transaction(async (tx) => {
        await tx.execute(sql.raw('SET LOCAL ROLE union_eyes_runtime'))
        await tx.execute(sql`SELECT set_config('app.current_org_id', ${organizationId}, true), set_config('app.current_user_id', ${ADMIN}, true)`)
        await installNativeBusinessContext((statement) => tx.execute(statement), binding)
        return work(tx as never)
      }))
    for (const [id, name] of [[ORG, 'Inbound Local'], [OTHER, 'Another Local']]) {
      await admin.query(
        `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
         VALUES ($1,$2,$3,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`,
        [id, name, `inb-${sfx}-${id.slice(0, 6)}`],
      )
      await seedDeclaredCanonicalActor(admin, ADMIN, id, 'admin')
    }
  }, 120_000)

  afterAll(async () => {
    await admin?.query('DROP TRIGGER IF EXISTS ue_fault_inbound_audit ON public.audit_logs').catch(() => undefined)
    await client?.end({ timeout: 5 }).catch(() => undefined)
    await admin?.end().catch(() => undefined)
  })

  it('authorizes a source and publishes an immutable, numbered mapping, each with its audit', async () => {
    for (const org of [ORG, OTHER]) {
      await inTenantTx(org, (tx) => inbound!.authorizeInboundSource(tx, { organizationId: org, sourceKey: SOURCE, actorId: ADMIN }))
      const published = await inTenantTx(org, (tx) => inbound!.publishMappingVersion(tx, { organizationId: org, sourceKey: SOURCE, actorId: ADMIN, sourceSchemaVersion: SCHEMA, rule: RULE as never }))
      expect(published.version).toBe(1)
      expect(published.ruleDigest).toMatch(/^[0-9a-f]{64}$/)
    }
    expect(await count(`SELECT count(*)::int n FROM public.audit_logs WHERE organization_id = $1 AND action IN ('integration.source.authorized','integration.mapping.published')`, [ORG])).toBe(2)
    await expect(admin.query(`UPDATE ue_integration_mapping_versions SET source_schema_version = 'v9' WHERE organization_id = $1`, [ORG])).rejects.toThrow(/UE_INTEGRATION_RECORD_IMMUTABLE/)
  })

  let firstReceipt: string
  let firstCase: string

  it('commits a valid inbound case with its link, mandatory audit, authoritative receipt and pending event, together (INT-01)', async () => {
    const outcome = expectReceipt(await executor().execute(delivery(ORG, 'evt-1', payload('C-1'))))
    expect(outcome).toMatchObject({ status: 'completed', replayed: false, effect: 'created', reasonCode: null })
    expect(outcome.caseId).toMatch(/^[0-9a-f-]{36}$/)
    firstReceipt = outcome.receiptId
    firstCase = outcome.caseId!
    const row = await receipt(firstReceipt)
    expect(row).toMatchObject({ status: 'completed', attempts: 1, case_id: firstCase, effect: 'created', mapping_version: 1 })
    const grievance = await one(`SELECT organization_id::text org, status, priority, type, title, source_system, external_case_id FROM grievances WHERE id = $1`, [firstCase])
    expect(grievance).toMatchObject({ org: ORG, status: 'filed', priority: 'high', type: 'contract', title: 'Case C-1', source_system: SOURCE, external_case_id: 'C-1' })
    const link = await one(`SELECT internal_id::text, created_by_receipt_id::text FROM ue_integration_identity_links WHERE organization_id = $1 AND entity_type = 'case' AND external_id = 'C-1'`, [ORG])
    expect(link).toEqual({ internal_id: firstCase, created_by_receipt_id: firstReceipt })
    expect(await audits(ORG, 'integration.inbound.case_created', firstReceipt)).toBe(1)
    expect(await outbox(firstReceipt)).toBe(1)
  })

  it('replays a repeated event from its receipt with one domain effect, and matches the same external case under a new key (INT-03, INT-16)', async () => {
    const again = expectReceipt(await executor().execute(delivery(ORG, 'evt-1', payload('C-1'))))
    expect(again).toMatchObject({ receiptId: firstReceipt, status: 'completed', replayed: true, caseId: firstCase })
    // Key order is not part of the event.
    const reordered = Object.fromEntries(Object.entries(payload('C-1')).reverse())
    expect(expectReceipt(await executor().execute(delivery(ORG, 'evt-1', reordered))).replayed).toBe(true)
    const update = expectReceipt(await executor().execute(delivery(ORG, 'evt-1b', payload('C-1', { subject: 'Changed upstream' }))))
    expect(update).toMatchObject({ status: 'completed', replayed: false, effect: 'existing', caseId: firstCase })
    expect(await cases(ORG, 'C-1')).toBe(1)
    expect(await count(`SELECT count(*)::int n FROM ue_integration_identity_links WHERE organization_id = $1 AND external_id = 'C-1'`, [ORG])).toBe(1)
    expect((await one(`SELECT title FROM grievances WHERE id = $1`, [firstCase])).title).toBe('Case C-1')
    expect(await audits(ORG, 'integration.inbound.case_created', firstReceipt)).toBe(1)
  })

  it('refuses a reused key carrying a different payload, writing nothing', async () => {
    const before = await count(`SELECT count(*)::int n FROM ue_integration_inbound_receipts WHERE organization_id = $1`, [ORG])
    const outcome = await executor().execute(delivery(ORG, 'evt-1', payload('C-1', { body: 'something else' })))
    expect(outcome).toMatchObject({ kind: 'conflict', code: 'IDEMPOTENCY_KEY_REUSED', receiptId: firstReceipt })
    expect(await count(`SELECT count(*)::int n FROM ue_integration_inbound_receipts WHERE organization_id = $1`, [ORG])).toBe(before)
    expect((await receipt(firstReceipt)).status).toBe('completed')
  })

  it('rejects malformed, unmappable and schema-drifted deliveries with a durable receipt and nothing else (INT-02, INT-11)', async () => {
    const malformed = expectReceipt(await executor().execute(delivery(ORG, 'evt-bad', payload('C-BAD', { urgency: 'whenever', opened: '2999-01-01', subject: '  ' }))))
    expect(malformed).toMatchObject({ status: 'rejected', reasonCode: 'SCHEMA_REJECTED', caseId: null })
    expect((await receipt(malformed.receiptId)).reason_detail).toEqual({ code: 'SCHEMA_REJECTED', fields: ['title:REQUIRED', 'priority:NOT_ALLOWED', 'filedDate:FUTURE_DATE'] })
    const unmappable = expectReceipt(await executor().execute(delivery(ORG, 'evt-unmapped', { id: 'C-UM', subject: 'no body' })))
    expect(unmappable).toMatchObject({ status: 'rejected', reasonCode: 'MAPPING_REJECTED' })
    const drifted = expectReceipt(await executor().execute(delivery(ORG, 'evt-drift', payload('C-DRIFT'), 'v2')))
    expect(drifted).toMatchObject({ status: 'rejected', reasonCode: 'SCHEMA_VERSION_DRIFT' })
    for (const [id, r] of [['C-BAD', malformed], ['C-UM', unmappable], ['C-DRIFT', drifted]] as const) {
      expect(await cases(ORG, id)).toBe(0)
      expect(await outbox(r.receiptId)).toBe(0)
      expect(await audits(ORG, 'integration.inbound.rejected', r.receiptId)).toBe(1)
    }
    expect(await count(`SELECT count(*)::int n FROM ue_integration_identity_links WHERE organization_id = $1 AND external_id IN ('C-BAD','C-UM','C-DRIFT')`, [ORG])).toBe(0)
    // A rejection is terminal: the same delivery gets the same answer, and the receipt cannot be rewritten.
    expect(expectReceipt(await executor().execute(delivery(ORG, 'evt-bad', payload('C-BAD', { urgency: 'whenever', opened: '2999-01-01', subject: '  ' }))))).toMatchObject({ status: 'rejected', replayed: true })
    await expect(admin.query(`UPDATE ue_integration_inbound_receipts SET status = 'failed', retryable = true WHERE id = $1`, [malformed.receiptId])).rejects.toThrow(/UE_INTEGRATION_RECEIPT_TERMINAL/)
  })

  it('records an audit fault as a retryable failure with no case, link or event, redacted, then completes on retry (INT-07, INT-09, INT-13)', async () => {
    await admin.query(`CREATE OR REPLACE FUNCTION public.ue_fault_inbound_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected fault for pat.member@example.test token=sk_live_abc123'; END $$`)
    await admin.query(`CREATE TRIGGER ue_fault_inbound_audit BEFORE INSERT ON public.audit_logs FOR EACH ROW WHEN (NEW.action = 'integration.inbound.case_created') EXECUTE FUNCTION public.ue_fault_inbound_audit()`)
    const body = payload('C-AUD', { body: 'Grievant pat.member@example.test, 613-555-0199' })
    const failed = expectReceipt(await executor().execute(delivery(ORG, 'evt-aud', body)))
    await admin.query('DROP TRIGGER ue_fault_inbound_audit ON public.audit_logs')
    expect(failed).toMatchObject({ status: 'failed', reasonCode: 'AUDIT_WRITE_FAILED', retryable: true, caseId: null })
    const stored = await receipt(failed.receiptId)
    expect(stored).toMatchObject({ status: 'failed', retryable: true, attempts: 1 })
    expect(stored.reason_detail).toMatchObject({ code: 'AUDIT_WRITE_FAILED', sqlstate: 'P0001' })
    expect(JSON.stringify(stored.reason_detail)).not.toMatch(/example\.test|sk_live|555|Grievant|injected/)
    expect(await cases(ORG, 'C-AUD')).toBe(0)
    expect(await count(`SELECT count(*)::int n FROM ue_integration_identity_links WHERE organization_id = $1 AND external_id = 'C-AUD'`, [ORG])).toBe(0)
    expect(await outbox(failed.receiptId)).toBe(0)

    const retried = expectReceipt(await executor().execute(delivery(ORG, 'evt-aud', body)))
    expect(retried).toMatchObject({ receiptId: failed.receiptId, status: 'completed', replayed: false, effect: 'created' })
    expect(await receipt(failed.receiptId)).toMatchObject({ attempts: 2, reason_code: null, reason_detail: null })
    expect(await cases(ORG, 'C-AUD')).toBe(1)
  })

  it('redacts a thrown failure that quotes payload values (INT-13)', async () => {
    const leaking = executor({ beforeAudit: async () => { throw new Error('cannot write Pat Member <pat.member@example.test> Bearer eyJhbGciOi') } })
    const outcome = expectReceipt(await leaking.execute(delivery(ORG, 'evt-leak', payload('C-LEAK'))))
    expect(outcome).toMatchObject({ status: 'failed', reasonCode: 'PERSISTENCE_FAILED' })
    expect((await receipt(outcome.receiptId)).reason_detail).toEqual({ code: 'PERSISTENCE_FAILED' })
    expect(await cases(ORG, 'C-LEAK')).toBe(0)
  })

  it('stops retrying after the attempt budget and preserves the failed status on replay', async () => {
    const failing = executor({ maxAttempts: 2, beforeAudit: async () => { throw new Error('down') } })
    const first = expectReceipt(await failing.execute(delivery(ORG, 'evt-budget', payload('C-BUDGET'))))
    expect(first).toMatchObject({ status: 'failed', retryable: true })
    const second = expectReceipt(await failing.execute(delivery(ORG, 'evt-budget', payload('C-BUDGET'))))
    expect(second).toMatchObject({ status: 'failed', retryable: false })
    const third = expectReceipt(await executor({ maxAttempts: 2 }).execute(delivery(ORG, 'evt-budget', payload('C-BUDGET'))))
    expect(third).toMatchObject({ status: 'failed', replayed: true, retryable: false, caseId: null })
    expect(await receipt(first.receiptId)).toMatchObject({ attempts: 2, retryable: false })
    await expect(admin.query(`UPDATE ue_integration_inbound_receipts SET status = 'claimed', claim_token = gen_random_uuid(), finished_at = NULL, reason_code = NULL WHERE id = $1`, [first.receiptId])).rejects.toThrow(/UE_INTEGRATION_RECEIPT_NOT_RETRYABLE/)
  })

  it('gives exactly one domain effect when concurrent workers race the same key (INT-06)', async () => {
    const slow = executor({ beforeAudit: async (tx) => { await tx.execute(sql`SELECT pg_sleep(0.4)`) } })
    const body = payload('C-RACE')
    const outcomes = (await Promise.all(Array.from({ length: 6 }, () => slow.execute(delivery(ORG, 'evt-race', body))))).map(expectReceipt)
    expect(new Set(outcomes.map((o) => o.receiptId)).size).toBe(1)
    const winners = outcomes.filter((o) => !o.replayed)
    expect(winners).toHaveLength(1)
    expect(winners[0]).toMatchObject({ status: 'completed', effect: 'created' })
    for (const other of outcomes.filter((o) => o.replayed)) expect(['claimed', 'completed']).toContain(other.status)
    expect(await cases(ORG, 'C-RACE')).toBe(1)
    expect(await count(`SELECT count(*)::int n FROM ue_integration_identity_links WHERE organization_id = $1 AND external_id = 'C-RACE'`, [ORG])).toBe(1)
    expect(await audits(ORG, 'integration.inbound.case_created', winners[0].receiptId)).toBe(1)
    expect(await outbox(winners[0].receiptId)).toBe(1)
    expect(await receipt(winners[0].receiptId)).toMatchObject({ attempts: 1, status: 'completed' })
  })

  it('races two raw claims on one key at the database: one row, one owner', async () => {
    const [source] = (await admin.query(`SELECT id::text FROM ue_integration_sources WHERE organization_id = $1 AND source_key = $2`, [ORG, SOURCE])).rows
    const claimAs = (token: string) => inTenantTx(ORG, async (tx) => {
      const result = await tx.execute(sql`INSERT INTO ue_integration_inbound_receipts (organization_id, source_id, idempotency_key, payload_digest, mapping_version, claim_token, lease_expires_at)
        VALUES (${ORG}::uuid, ${source.id}::uuid, 'evt-raw', ${'a'.repeat(64)}, 1, ${token}::uuid, now() + interval '1 minute')
        ON CONFLICT (organization_id, source_id, idempotency_key) DO NOTHING RETURNING claim_token::text`)
      await tx.execute(sql`SELECT pg_sleep(0.3)`)
      return inbound!.rowsOf<{ claim_token: string }>(result).length
    })
    const owners = await Promise.all([claimAs(randomUUID()), claimAs(randomUUID())])
    expect(owners.sort()).toEqual([0, 1])
    expect(await count(`SELECT count(*)::int n FROM ue_integration_inbound_receipts WHERE organization_id = $1 AND idempotency_key = 'evt-raw'`, [ORG])).toBe(1)
  })

  it('recovers a claim whose worker died, once, after its lease, without inventing a status before then (INT-08, INT-16)', async () => {
    let calls = 0
    // The worker claims (first transaction), then dies: its work and its failure record never reach the database.
    const dying = new inbound!.DurableInboundCaseExecutor({
      inTenantTx: (org, work) => (++calls === 1 ? inTenantTx(org, work) : Promise.reject(new Error('worker died'))),
    })
    const body = payload('C-CRASH')
    await expect(dying.execute(delivery(ORG, 'evt-crash', body))).rejects.toThrow('worker died')
    const claimed = await one(`SELECT id::text, status, attempts FROM ue_integration_inbound_receipts WHERE organization_id = $1 AND idempotency_key = 'evt-crash'`, [ORG])
    expect(claimed).toMatchObject({ status: 'claimed', attempts: 1 })
    expect(await cases(ORG, 'C-CRASH')).toBe(0)
    // While the lease holds, a redelivery is told the truth: claimed, not completed and not failed.
    expect(expectReceipt(await executor().execute(delivery(ORG, 'evt-crash', body)))).toMatchObject({ status: 'claimed', replayed: true, caseId: null })
    await admin.query(`UPDATE ue_integration_inbound_receipts SET lease_expires_at = now() - interval '1 second' WHERE id = $1`, [claimed.id])
    const recovered = (await Promise.all([executor().execute(delivery(ORG, 'evt-crash', body)), executor().execute(delivery(ORG, 'evt-crash', body))])).map(expectReceipt)
    expect(recovered.filter((o) => !o.replayed)).toHaveLength(1)
    expect(recovered.find((o) => !o.replayed)).toMatchObject({ status: 'completed', effect: 'created' })
    expect(await cases(ORG, 'C-CRASH')).toBe(1)
    expect(await receipt(claimed.id)).toMatchObject({ status: 'completed', attempts: 2 })
  })

  it('fences a worker whose lease was taken over: it cannot complete or double the effect', async () => {
    const body = payload('C-FENCE')
    let calls = 0
    const stale = new inbound!.DurableInboundCaseExecutor({
      inTenantTx: async (org, work) => {
        calls += 1
        if (calls === 2) {
          // Between the stale worker's claim and its work, its lease runs out and another worker completes the receipt.
          await admin.query(`UPDATE ue_integration_inbound_receipts SET lease_expires_at = now() - interval '1 second' WHERE organization_id = $1 AND idempotency_key = 'evt-fence'`, [ORG])
          const taken = expectReceipt(await executor().execute(delivery(ORG, 'evt-fence', body)))
          expect(taken).toMatchObject({ status: 'completed', replayed: false })
        }
        return inTenantTx(org, work)
      },
    })
    const outcome = expectReceipt(await stale.execute(delivery(ORG, 'evt-fence', body)))
    expect(outcome).toMatchObject({ status: 'completed', replayed: true })
    expect(await cases(ORG, 'C-FENCE')).toBe(1)
    expect(await audits(ORG, 'integration.inbound.case_created', outcome.receiptId)).toBe(1)
    expect(await receipt(outcome.receiptId)).toMatchObject({ attempts: 2 })
  })

  it('quarantines an unlinked existing case, a stale link and an unresolved member with a reason, never relinking (INT-04, INT-10)', async () => {
    await admin.query(`INSERT INTO grievances (grievance_number, external_case_id, source_system, organization_id, type, status, priority, title, description, filed_date, created_at, updated_at)
      VALUES ($1, 'C-NATIVE', $2, $3, 'contract', 'filed', 'low', 'Entered before the integration', 'd', now(), now(), now())`, [`N-${sfx}`, SOURCE, ORG])
    const unlinked = expectReceipt(await executor().execute(delivery(ORG, 'evt-unlinked', payload('C-NATIVE'))))
    expect(unlinked).toMatchObject({ status: 'quarantined', reasonCode: 'UNLINKED_ENTITY_EXISTS', caseId: null })
    expect((await one(`SELECT title FROM grievances WHERE organization_id = $1 AND external_case_id = 'C-NATIVE'`, [ORG])).title).toBe('Entered before the integration')
    expect(await audits(ORG, 'integration.inbound.quarantined', unlinked.receiptId)).toBe(1)

    await admin.query(`UPDATE ue_integration_identity_links SET stale_at = now(), stale_reason = 'source no longer recognizes it' WHERE organization_id = $1 AND external_id = 'C-1'`, [ORG])
    const stale = expectReceipt(await executor().execute(delivery(ORG, 'evt-stale', payload('C-1'))))
    expect(stale).toMatchObject({ status: 'quarantined', reasonCode: 'IDENTITY_LINK_STALE' })
    await expect(admin.query(`UPDATE ue_integration_identity_links SET internal_id = gen_random_uuid() WHERE organization_id = $1 AND external_id = 'C-1'`, [ORG])).rejects.toThrow(/UE_INTEGRATION_IDENTITY_LINK_IMMUTABLE/)
    await expect(admin.query(`DELETE FROM ue_integration_identity_links WHERE organization_id = $1 AND external_id = 'C-1'`, [ORG])).rejects.toThrow(/UE_INTEGRATION_IDENTITY_LINK_RETAINED/)

    const member = expectReceipt(await executor().execute(delivery(ORG, 'evt-member', payload('C-MEMBER', { member: 'M-404' }))))
    expect(member).toMatchObject({ status: 'quarantined', reasonCode: 'MEMBER_IDENTITY_UNRESOLVED' })
    expect(await cases(ORG, 'C-MEMBER')).toBe(0)
    for (const r of [unlinked, stale, member]) expect(await outbox(r.receiptId)).toBe(0)
    await expect(admin.query(`UPDATE ue_integration_inbound_receipts SET reason_code = 'X' WHERE id = $1`, [member.receiptId])).rejects.toThrow(/UE_INTEGRATION_RECEIPT_TERMINAL/)
  })

  it('keeps organizations apart: a foreign source is invisible and the same external id is another case (INT-05)', async () => {
    const otherSource = `other-${sfx}`
    await inTenantTx(OTHER, (tx) => inbound!.authorizeInboundSource(tx, { organizationId: OTHER, sourceKey: otherSource, actorId: ADMIN }))
    expect(await executor().execute({ ...delivery(ORG, 'evt-foreign', payload('C-X')), sourceKey: otherSource })).toMatchObject({ kind: 'denied', code: 'SOURCE_NOT_AUTHORIZED', persisted: false })
    const elsewhere = expectReceipt(await executor().execute(delivery(OTHER, 'evt-1', payload('C-1'))))
    expect(elsewhere).toMatchObject({ status: 'completed', effect: 'created' })
    expect(elsewhere.caseId).not.toBe(firstCase)
    expect(elsewhere.receiptId).not.toBe(firstReceipt)
    expect(await cases(OTHER, 'C-1')).toBe(1)
    // The tenant transaction of one organization cannot see, claim or link against another's rows.
    const [foreign] = (await admin.query(`SELECT id::text FROM ue_integration_sources WHERE organization_id = $1 AND source_key = $2`, [OTHER, SOURCE])).rows
    const visible = await inTenantTx(ORG, async (tx) => inbound!.rowsOf(await tx.execute(sql`SELECT id FROM ue_integration_inbound_receipts WHERE organization_id = ${OTHER}::uuid`)))
    expect(visible).toHaveLength(0)
    await expectRefused(inTenantTx(ORG, (tx) => tx.execute(sql`INSERT INTO ue_integration_inbound_receipts (organization_id, source_id, idempotency_key, payload_digest, mapping_version, claim_token, lease_expires_at)
      VALUES (${ORG}::uuid, ${foreign.id}::uuid, 'evt-cross', ${'b'.repeat(64)}, 1, gen_random_uuid(), now())`)))
  })

  it('denies new ingest from a revoked source, at the database too, and keeps what it imported (INT-12)', async () => {
    const revoked = await inTenantTx(ORG, (tx) => inbound!.revokeInboundSource(tx, { organizationId: ORG, sourceKey: SOURCE, actorId: ADMIN, reason: 'contract ended' }))
    expect(revoked).toEqual({ revoked: true })
    expect(await executor().execute(delivery(ORG, 'evt-after-revoke', payload('C-NEW')))).toMatchObject({ kind: 'denied', code: 'SOURCE_REVOKED', persisted: false })
    expect(await count(`SELECT count(*)::int n FROM ue_integration_inbound_receipts WHERE organization_id = $1 AND idempotency_key = 'evt-after-revoke'`, [ORG])).toBe(0)
    // History stays and still answers truthfully.
    expect(expectReceipt(await executor().execute(delivery(ORG, 'evt-1', payload('C-1'))))).toMatchObject({ status: 'completed', replayed: true, caseId: firstCase })
    expect(await cases(ORG, 'C-1')).toBe(1)
    const [source] = (await admin.query(`SELECT id::text FROM ue_integration_sources WHERE organization_id = $1 AND source_key = $2`, [ORG, SOURCE])).rows
    await expectRefused(inTenantTx(ORG, (tx) => tx.execute(sql`INSERT INTO ue_integration_inbound_receipts (organization_id, source_id, idempotency_key, payload_digest, mapping_version, claim_token, lease_expires_at)
      VALUES (${ORG}::uuid, ${source.id}::uuid, 'evt-direct', ${'c'.repeat(64)}, 1, gen_random_uuid(), now())`)), /UE_INTEGRATION_SOURCE_NOT_ACTIVE/)
    await expect(admin.query(`UPDATE ue_integration_sources SET status = 'active', revoked_at = NULL, revoked_by = NULL, revocation_reason = NULL WHERE id = $1`, [source.id])).rejects.toThrow(/UE_INTEGRATION_SOURCE_IMMUTABLE/)
    await expect(admin.query(`DELETE FROM ue_integration_sources WHERE id = $1`, [source.id])).rejects.toThrow(/UE_INTEGRATION_SOURCE_RETAINED/)
  })

  it('publishes only committed events, per organization, once, and keeps a failed publication pending (INT-08, INT-15)', async () => {
    const pendingBefore = await count(`SELECT count(*)::int n FROM ue_integration_outbox WHERE organization_id = $1 AND published_at IS NULL`, [ORG])
    expect(pendingBefore).toBeGreaterThan(0)
    const failing = await inbound!.publishCommittedInboundEvents(inTenantTx, ORG, async () => { throw new Error('subscriber down') })
    expect(failing).toEqual({ published: 0, failed: pendingBefore })
    expect(await count(`SELECT count(*)::int n FROM ue_integration_outbox WHERE organization_id = $1 AND published_at IS NULL`, [ORG])).toBe(pendingBefore)
    const seen: Array<{ organizationId: string; payload: Record<string, unknown> }> = []
    const result = await inbound!.publishCommittedInboundEvents(inTenantTx, ORG, async (event) => { seen.push(event) })
    expect(result).toEqual({ published: pendingBefore, failed: 0 })
    expect(seen.every((e) => e.organizationId === ORG)).toBe(true)
    for (const event of seen) expect(Object.keys(event.payload).sort()).toEqual(['caseId', 'effect', 'receiptId', 'sourceId'])
    expect(await inbound!.publishCommittedInboundEvents(inTenantTx, ORG, async () => undefined)).toEqual({ published: 0, failed: 0 })
    expect(await count(`SELECT count(*)::int n FROM ue_integration_outbox WHERE organization_id = $1 AND published_at IS NULL`, [OTHER])).toBe(1)
    await expect(admin.query(`UPDATE ue_integration_outbox SET payload = '{}'::jsonb WHERE organization_id = $1`, [ORG])).rejects.toThrow(/UE_INTEGRATION_OUTBOX_IMMUTABLE/)
  })
})
