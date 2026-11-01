/**
 * Tenant isolation of the remediated routes on the COMBINED deployed schema, as the real runtime and system roles.
 *
 * The route handlers run unmodified. Only the transport is substituted: withRLSContext opens a real transaction, assumes
 * `union_eyes_runtime` and sets `app.current_org_id` exactly as the deployed wrapper does; withSystemContext assumes
 * `union_eyes_system`. Every statement therefore meets the deployed row-level security, grants and constraints.
 *
 * Several cases run as the superuser, where row-level security does not apply, to prove that the repaired statement
 * itself carries the tenant predicate rather than resting on the database policy alone.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a FRESH disposable database prepared as for
 * authority-kernel-combined.postgres.test.ts. Not a staging isolation pass.
 */
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const URL = process.env.UE_AUTHORITY_COMBINED_URL

const state = vi.hoisted(() => ({
  admin: null as unknown,
  audit: [] as Array<Record<string, unknown>>,
  minRole: true,
  pool: null as unknown,
}))

type Tx = ReturnType<typeof drizzle>

async function inRole<T>(role: string, organizationId: string | null, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const pool = state.pool as pg.Pool
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`SET LOCAL ROLE ${role}`)
    if (organizationId) await client.query(`SELECT set_config('app.current_org_id', $1, true)`, [organizationId])
    const db = drizzle(client)
    // The production driver returns rows directly from execute(); node-postgres' drizzle wrapper returns a result object.
    const execute = db.execute.bind(db)
    ;(db as unknown as { execute: unknown }).execute = async (q: never) => (await execute(q)).rows
    const result = await fn(db)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (ctx: { organizationId: string }, fn: (tx: unknown) => Promise<unknown>) =>
    inRole('union_eyes_runtime', ctx.organizationId, fn as never),
  withSystemContext: async (fn: (tx: unknown) => Promise<unknown>) => inRole('union_eyes_system', null, fn as never),
}))
// A statement outside any tenant transaction, on the admin connection: used by the sharing-authority hierarchy lookups,
// the report executor and the reconciliation service. Row-level security does not apply to it.
const bareDb = () =>
  new Proxy({}, {
    get(_t, prop) {
      const admin = state.admin as Tx
      const value = (admin as unknown as Record<PropertyKey, unknown>)[prop]
      if (prop === 'execute') {
        return async (q: never) => (await (admin as unknown as { execute(q: never): Promise<{ rows: unknown[] }> }).execute(q)).rows
      }
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(admin) : value
    },
  })
vi.mock('@/db/db', () => ({ db: bareDb() }))
vi.mock('@/db', () => ({ db: bareDb() }))
vi.mock('@/lib/audit-logger', () => ({ auditLog: async () => undefined, AuditEventType: {}, AuditSeverity: {} }))
vi.mock('@/lib/audit/atomic-audit', () => ({
  persistAtomicAudit: async (_tx: unknown, entry: Record<string, unknown>) => {
    state.audit.push(entry)
  },
}))
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: async () => state.minRole }))
vi.mock('@/lib/api/framework', async () => {
  const { z } = await import('zod')
  const make = (status: number) => (message: string) => Object.assign(new Error(message), { status })
  return {
    z,
    withApi: (_cfg: unknown, handler: (c: unknown) => Promise<unknown>) => (c: unknown) => handler(c),
    ApiError: {
      badRequest: make(400),
      forbidden: make(403),
      notFound: (kind: string) => Object.assign(new Error(`${kind} not found`), { status: 404 }),
    },
  }
})
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }))

describe.skipIf(!URL)('remediated routes on the combined schema, as the runtime role', () => {
  const ORG_A = randomUUID()
  const ORG_B = randomUUID()
  const P_A_PRIVATE = randomUUID()
  const P_A_PUBLIC = randomUUID()
  const P_A_GRANTED = randomUUID()
  const P_A_FEDERATION = randomUUID()
  const ORG_C = randomUUID()
  const P_B = randomUUID()
  const S_A = randomUUID()
  const S_A_ENDED = randomUUID()
  const S_B = randomUUID()
  let admin: pg.Client
  let pool: pg.Pool

  const scalar = async (query: string, params: unknown[] = []) => (await admin.query(query, params)).rows[0]

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    pool = new pg.Pool({ connectionString: URL, max: 8 })
    state.admin = drizzle(admin)
    state.pool = pool
    // The runtime and system roles must be able to assume the role: the pool connects as the admin user.
    for (const [org, slug] of [[ORG_A, `iso-a-${ORG_A.slice(0, 6)}`], [ORG_B, `iso-b-${ORG_B.slice(0, 6)}`]]) {
      await admin.query(
        `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
         VALUES ($1,$2,$3,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`,
        [org, slug, slug],
      )
    }
    const precedent = (id: string, org: string, sharing: string, grants: string[] | null = null) =>
      admin.query(
        `INSERT INTO arbitration_precedents (id, source_organization_id, case_title, decision_date, arbitrator_name, jurisdiction,
            grievance_type, issue_summary, outcome, decision_summary, sharing_level, shared_with_org_ids, created_by, document_url)
         VALUES ($1,$2,'title','2026-01-01','Arb','ON','discipline','issue','upheld','summary',$3,$4,'owner','https://store/private.pdf')`,
        [id, org, sharing, grants],
      )
    await precedent(P_A_PRIVATE, ORG_A, 'private')
    await precedent(P_A_PUBLIC, ORG_A, 'public')
    await precedent(P_A_GRANTED, ORG_A, 'private', [ORG_B])
    await precedent(P_A_FEDERATION, ORG_A, 'federation')
    await precedent(P_B, ORG_B, 'private')
    const steward = (id: string, org: string, status: string) =>
      admin.query(
        `INSERT INTO steward_assignments (id, organization_id, steward_id, steward_type, status, start_date, personal_phone, notes)
         VALUES ($1,$2,$3,'steward',$4,'2026-01-01','613-555-0199','private note')`,
        [id, org, `user-${id.slice(0, 6)}`, status],
      )
    await steward(S_A, ORG_A, 'active')
    await steward(S_A_ENDED, ORG_A, 'ended')
    await steward(S_B, ORG_B, 'active')
  }, 120_000)

  afterAll(async () => {
    await pool?.end()
    await admin?.end()
  })

  beforeEach(() => {
    state.audit.length = 0
    state.minRole = true
  })

  describe('arbitration precedents', () => {
    const ctx = (organizationId: string, id: string, body?: unknown) => ({ organizationId, userId: 'user-1', params: { id }, request: { json: async () => body } })

    it('the deployed policy hides another organization\'s precedent from the runtime role and refuses its writes', async () => {
      const rows = (await inRole('union_eyes_runtime', ORG_B, (tx) => (tx as unknown as { $client: pg.Client }).$client.query('SELECT id FROM arbitration_precedents'))) as pg.QueryResult
      // Own rows, plus rows another organization shared with this one (an explicit grant or public) under 0030; never the rest.
      expect(rows.rows.map((r: { id: string }) => r.id).sort()).toEqual([P_B, P_A_PUBLIC, P_A_GRANTED].sort())
      const update = (await inRole('union_eyes_runtime', ORG_B, (tx) => (tx as unknown as { $client: pg.Client }).$client.query(`UPDATE arbitration_precedents SET case_title = 'x' WHERE id = $1`, [P_A_PRIVATE]))) as pg.QueryResult
      expect(update.rowCount).toBe(0)
      const del = (await inRole('union_eyes_runtime', ORG_B, (tx) => (tx as unknown as { $client: pg.Client }).$client.query('DELETE FROM arbitration_precedents WHERE id = $1', [P_A_PRIVATE]))) as pg.QueryResult
      expect(del.rowCount).toBe(0)
    })

    it('GET: a precedent shared by an explicit grant or made public reads to the other organization as a projection, never the owner\'s working material', async () => {
      const { GET } = await import('../../app/api/precedents/[id]/route')
      for (const id of [P_A_GRANTED, P_A_PUBLIC]) {
        const { data } = (await (GET as any)(ctx(ORG_B, id))) as { data: Record<string, unknown> }
        expect(data, id).toMatchObject({ id, isOwner: false })
        for (const hidden of ['documentUrl', 'documentPath', 'sharedWithOrgIds', 'createdBy']) expect(data, `${id} ${hidden}`).not.toHaveProperty(hidden)
        // The fixture has no redacted copy, so a reader is offered no document location at all.
        expect(data.redactedDocumentUrl).toBeNull()
      }
    })

    it('GET: negative disclosure: an un-granted private precedent, a federation-level one, and a third organization all read as not found', async () => {
      const { GET } = await import('../../app/api/precedents/[id]/route')
      await expect((GET as any)(ctx(ORG_B, P_A_PRIVATE))).rejects.toMatchObject({ status: 404 })
      await expect((GET as any)(ctx(ORG_B, P_A_FEDERATION))).rejects.toMatchObject({ status: 404 })
      await expect((GET as any)(ctx(ORG_C, P_A_GRANTED))).rejects.toMatchObject({ status: 404 })
      // The grant names one organization: a malformed or empty context never matches it.
      const none = (await inRole('union_eyes_runtime', null, (tx) => (tx as unknown as { $client: pg.Client }).$client.query('SELECT id FROM arbitration_precedents'))) as pg.QueryResult
      expect(none.rows.map((r: { id: string }) => r.id)).toEqual([P_A_PUBLIC])
    })

    it('revocation takes effect at once: removing the grant makes the precedent not found again, and restoring it admits it', async () => {
      const { GET } = await import('../../app/api/precedents/[id]/route')
      await admin.query('UPDATE arbitration_precedents SET shared_with_org_ids = $2 WHERE id = $1', [P_A_GRANTED, []])
      await expect((GET as any)(ctx(ORG_B, P_A_GRANTED))).rejects.toMatchObject({ status: 404 })
      await admin.query('UPDATE arbitration_precedents SET shared_with_org_ids = $2 WHERE id = $1', [P_A_GRANTED, [ORG_B]])
      expect(((await (GET as any)(ctx(ORG_B, P_A_GRANTED))) as { data: { id: string } }).data.id).toBe(P_A_GRANTED)
    })

    it('reading a shared precedent never implies writing it: the grantee\'s UPDATE and DELETE touch nothing', async () => {
      const q = (sqlText: string, params: unknown[]) => inRole('union_eyes_runtime', ORG_B, (tx) => (tx as unknown as { $client: pg.Client }).$client.query(sqlText, params)) as Promise<pg.QueryResult>
      for (const id of [P_A_GRANTED, P_A_PUBLIC]) {
        expect((await q(`UPDATE arbitration_precedents SET case_title = 'hijacked' WHERE id = $1`, [id])).rowCount).toBe(0)
        expect((await q('DELETE FROM arbitration_precedents WHERE id = $1', [id])).rowCount).toBe(0)
      }
      expect((await q(`INSERT INTO arbitration_precedents (id, source_organization_id, case_title, decision_date, arbitrator_name, jurisdiction, grievance_type, issue_summary, outcome, decision_summary, sharing_level, created_by)
        VALUES (gen_random_uuid(), $1, 't', '2026-01-01', 'a', 'ON', 'g', 'i', 'o', 'd', 'private', 'x') RETURNING id`, [ORG_A]).catch((e: Error) => e)) instanceof Error).toBe(true)
    })
    it('PATCH: a sharing level the owner has no standing for is refused and not stored', async () => {
      const { PATCH } = await import('../../app/api/precedents/[id]/route')
      await expect((PATCH as any)(ctx(ORG_A, P_A_PUBLIC, { sharingLevel: 'federation' }))).rejects.toMatchObject({ status: 403 })
      expect((await scalar('SELECT sharing_level FROM arbitration_precedents WHERE id = $1', [P_A_PUBLIC])).sharing_level).toBe('public')
    })

    it('GET: the owner reads the full row', async () => {
      const { GET } = await import('../../app/api/precedents/[id]/route')
      const { data } = (await (GET as any)(ctx(ORG_A, P_A_PRIVATE))) as { data: Record<string, unknown> }
      expect(data).toMatchObject({ isOwner: true, documentUrl: 'https://store/private.pdf' })
    })

    it('PATCH and DELETE by another organization change nothing, whatever the sharing level', async () => {
      const { PATCH, DELETE } = await import('../../app/api/precedents/[id]/route')
      for (const id of [P_A_PRIVATE, P_A_PUBLIC, P_A_GRANTED]) {
        await expect((PATCH as any)(ctx(ORG_B, id, { caseTitle: 'hijacked' }))).rejects.toMatchObject({ status: 404 })
        await expect((DELETE as any)(ctx(ORG_B, id))).rejects.toMatchObject({ status: 404 })
      }
      expect((await scalar(`SELECT count(*)::int AS n FROM arbitration_precedents WHERE case_title = 'hijacked'`)).n).toBe(0)
      expect((await scalar(`SELECT count(*)::int AS n FROM arbitration_precedents WHERE id IN ($1,$2)`, [P_A_PRIVATE, P_A_PUBLIC])).n).toBe(2)
      expect(state.audit).toHaveLength(0)
    })

    it('PATCH by the owner persists and audits', async () => {
      const { PATCH } = await import('../../app/api/precedents/[id]/route')
      await (PATCH as any)(ctx(ORG_A, P_A_PRIVATE, { caseTitle: 'renamed by owner' }))
      expect((await scalar('SELECT case_title FROM arbitration_precedents WHERE id = $1', [P_A_PRIVATE])).case_title).toBe('renamed by owner')
      expect(state.audit).toContainEqual(expect.objectContaining({ action: 'precedent.update', resourceId: P_A_PRIVATE }))
    })
  })

  describe('steward directory', () => {
    const list = (organizationId: string) => ({ request: new Request('http://localhost/api/stewards'), organizationId, userId: 'user-1' })

    it('a member lists only their own organization\'s active assignments, without private contact, notes or grievance link', async () => {
      state.minRole = false
      const { GET } = await import('../../app/api/stewards/route')
      const result = (await (GET as any)(list(ORG_B))) as { view: string; data: Array<Record<string, unknown>> }
      expect(result.view).toBe('member')
      expect(result.data.map((r) => r.id)).toEqual([S_B])
      for (const key of ['personalPhone', 'notes', 'availabilityNotes', 'grievanceId', 'createdBy', 'organizationId']) expect(result.data[0]).not.toHaveProperty(key)
    })

    it('a member cannot read another organization\'s assignment by id, nor a non-active one of their own', async () => {
      state.minRole = false
      const { GET } = await import('../../app/api/stewards/[id]/route')
      await expect((GET as any)({ params: { id: S_A }, organizationId: ORG_B, userId: 'user-1' })).rejects.toMatchObject({ status: 404 })
      await expect((GET as any)({ params: { id: S_A_ENDED }, organizationId: ORG_A, userId: 'user-1' })).rejects.toMatchObject({ status: 404 })
      const ok = (await (GET as any)({ params: { id: S_A }, organizationId: ORG_A, userId: 'user-1' })) as { data: Record<string, unknown> }
      expect(ok.data).not.toHaveProperty('personalPhone')
    })

    it('an officer of the owning organization reads the full row, audited; an officer of another organization cannot', async () => {
      state.minRole = true
      const { GET } = await import('../../app/api/stewards/[id]/route')
      const full = (await (GET as any)({ params: { id: S_A }, organizationId: ORG_A, userId: 'officer-a' })) as { data: Record<string, unknown>; view: string }
      expect(full).toMatchObject({ view: 'officer' })
      expect(full.data).toHaveProperty('personalPhone', '613-555-0199')
      expect(state.audit).toContainEqual(expect.objectContaining({ action: 'stewards.assignment.read_private', resourceId: S_A, organizationId: ORG_A }))
      await expect((GET as any)({ params: { id: S_A }, organizationId: ORG_B, userId: 'officer-b' })).rejects.toMatchObject({ status: 404 })
    })
  })

  describe('report execution joins', () => {
    const MEMBER_A = randomUUID()
    const MEMBER_B = randomUUID()
    const CLAIM_A = randomUUID()
    const CLAIM_B = randomUUID()
    const DEADLINE_B = randomUUID()

    beforeAll(async () => {
      const member = (id: string, org: string, user: string) =>
        admin.query(`INSERT INTO organization_members (id, created_at, updated_at, user_id, role, status, is_primary, organization_id) VALUES ($1, now(), now(), $2, 'member', 'active', false, $3)`, [id, user, org])
      await member(MEMBER_A, ORG_A, `rep-user-a-${MEMBER_A.slice(0, 6)}`)
      await member(MEMBER_B, ORG_B, `rep-user-b-${MEMBER_B.slice(0, 6)}`)
      const claim = (id: string, org: string) =>
        admin.query(`INSERT INTO claims (id, created_at, updated_at, claim_id, is_anonymous, previously_reported, priority, progress, status, witnesses_present, organization_id) VALUES ($1, now(), now(), $1, false, false, 'medium', 0, 'open', false, $2)`, [id, org])
      await claim(CLAIM_A, ORG_A)
      await claim(CLAIM_B, ORG_B)
      await admin.query(
        `INSERT INTO claim_deadlines (id, created_at, updated_at, claim_id, alert_count, days_overdue, extension_count, is_overdue, priority, status, total_extension_days, organization_id)
         VALUES ($1, now(), now(), $2, 0, 0, 0, false, 'medium', 'open', 0, $3)`,
        [DEADLINE_B, CLAIM_B, ORG_B],
      )
    })

    const run = async (organizationId: string, config: Record<string, unknown>) => {
      const { ReportExecutor } = await import('../../lib/report-executor')
      const result = await new ReportExecutor(organizationId).execute(config as never)
      expect(result.error).toBeUndefined()
      return (result.data ?? []) as unknown as Array<Record<string, string>>
    }
    const nonEqui = {
      dataSourceId: 'claims',
      fields: [{ fieldId: 'id', fieldName: 'Claim', table: 'claims', alias: 'claim_id' }, { fieldId: 'id', fieldName: 'Member', table: 'organization_members', alias: 'member_id' }],
      joins: [{ table: 'organization_members', type: 'inner', on: { leftField: 'claims.id', rightField: 'organization_members.id', operator: '!=' } }],
    }

    it('a non-equi join as ORG_A returns no row of ORG_B, even on a connection where row-level security does not apply', async () => {
      const rows = await run(ORG_A, nonEqui)
      expect(rows.map((r) => r.member_id)).not.toContain(MEMBER_B)
      expect(rows.every((r) => r.claim_id === CLAIM_A || r.claim_id === undefined)).toBe(true)
    })

    it('a LEFT join to deadlines does not attach ORG_B\'s deadline to ORG_A\'s claims', async () => {
      const rows = await run(ORG_A, {
        dataSourceId: 'claims',
        fields: [{ fieldId: 'id', fieldName: 'Deadline', table: 'claim_deadlines', alias: 'deadline_id' }],
        joins: [{ table: 'claim_deadlines', type: 'left', on: { leftField: 'claims.id', rightField: 'claim_deadlines.id', operator: '!=' } }],
      })
      expect(rows.map((r) => r.deadline_id)).not.toContain(DEADLINE_B)
    })

    it('the same statement as ORG_B returns ORG_B\'s own member, proving the first result was filtered, not empty', async () => {
      const rows = await run(ORG_B, nonEqui)
      expect(rows.map((r) => r.member_id)).toEqual([MEMBER_B])
    })
  })

  describe('reconciliation run lookup', () => {
    it('returns a run to its own organization and nothing to another, on a connection where row-level security does not apply', async () => {
      const run = randomUUID()
      await admin.query(`INSERT INTO reconciliation_runs (id, organization_id, period_start, period_end) VALUES ($1, $2, now() - interval '30 days', now())`, [run, ORG_A])
      const { getReconciliationRun } = await import('../../services/platform-economics/reconciliation-service')
      expect(await getReconciliationRun(run, ORG_B)).toBeNull()
      expect(await getReconciliationRun(run, ORG_A)).toMatchObject({ id: run })
    })
  })

  describe('dues initiation under real concurrency', () => {
    const USER = `dues-member-${randomUUID().slice(0, 8)}`
    const OTHER = `dues-other-${randomUUID().slice(0, 8)}`

    beforeAll(async () => {
      for (const [user, amount] of [[USER, 25], [OTHER, 40]] as const) {
        await admin.query(
          `INSERT INTO member_dues_ledger (user_id, organization_id, transaction_type, transaction_date, effective_date, amount, balance_before, balance_after, description, status)
           VALUES ($1, $2, 'charge', now(), now(), $3, 0, $3, 'monthly dues', 'posted')`,
          [user, ORG_A, amount],
        )
      }
    })

    const gateway = () => ({
      paymentIntents: {
        create: async (_p: unknown, options?: { idempotencyKey?: string }) => ({ id: `pi_${options?.idempotencyKey}`, client_secret: 'secret' }),
        cancel: async () => ({}),
      },
    })

    it('ten simultaneous initiations by one member create one payment, on separate connections', async () => {
      const { initiateDuesPayment } = await import('../../lib/dues/dues-payment-service')
      const results = await Promise.all(
        Array.from({ length: 10 }, () => initiateDuesPayment({ organizationId: ORG_A, userId: USER, gateway: gateway(), providerConfigured: true })),
      )
      expect(new Set(results.map((r) => r.paymentId)).size).toBe(1)
      expect((await scalar(`SELECT count(*)::int AS n FROM dues_transactions WHERE member_id = $1`, [USER])).n).toBe(1)
      expect((await scalar(`SELECT status FROM dues_transactions WHERE member_id = $1`, [USER])).status).toBe('pending')
    })

    it('another member and another organization are unaffected, and ORG_B\'s runtime context cannot see the payment', async () => {
      const { initiateDuesPayment } = await import('../../lib/dues/dues-payment-service')
      const other = await initiateDuesPayment({ organizationId: ORG_A, userId: OTHER, gateway: gateway(), providerConfigured: true })
      expect(other.amount).toBe('40.00')
      const visibleToB = (await inRole('union_eyes_runtime', ORG_B, (tx) => (tx as unknown as { $client: pg.Client }).$client.query('SELECT id FROM dues_transactions'))) as pg.QueryResult
      expect(visibleToB.rows).toEqual([])
    })
  })

  describe('dues settlement under real concurrency', () => {
    const MEMBER = `settle-member-${randomUUID().slice(0, 8)}`
    let paymentId = ''
    let intentId = ''

    const intent = async (overrides: Record<string, unknown> = {}) => {
      const { DUES_PAYMENT_KIND, DUES_CURRENCY } = await import('../../lib/dues/dues-payment-service')
      return {
        id: intentId,
        amount_received: 3000,
        currency: DUES_CURRENCY,
        metadata: { ue_payment_kind: DUES_PAYMENT_KIND, ue_dues_payment_id: paymentId, organization_id: ORG_A, member_user_id: MEMBER },
        ...overrides,
      }
    }
    const settle = async (eventId: string, overrides: Record<string, unknown> = {}) => {
      const { settleDuesPaymentIntent } = await import('../../lib/dues/dues-settlement')
      const pi = await intent(overrides)
      return inRole('union_eyes_system', null, (tx) => settleDuesPaymentIntent(tx as never, pi as never, eventId))
    }
    const ledgerRows = async () =>
      (await admin.query(`SELECT transaction_type, amount::text AS amount, payment_reference FROM member_dues_ledger WHERE user_id = $1 AND organization_id = $2 AND transaction_type = 'payment'`, [MEMBER, ORG_A])).rows

    beforeAll(async () => {
      await admin.query(
        `INSERT INTO member_dues_ledger (user_id, organization_id, transaction_type, transaction_date, effective_date, amount, balance_before, balance_after, description, status)
         VALUES ($1, $2, 'charge', now(), now(), 30, 0, 30, 'monthly dues', 'posted')`,
        [MEMBER, ORG_A],
      )
      const { initiateDuesPayment } = await import('../../lib/dues/dues-payment-service')
      const created = await initiateDuesPayment({
        organizationId: ORG_A,
        userId: MEMBER,
        providerConfigured: true,
        gateway: { paymentIntents: { create: async (_p: unknown, o?: { idempotencyKey?: string }) => ({ id: `pi_${o?.idempotencyKey}`, client_secret: 's' }), cancel: async () => ({}) } },
      })
      paymentId = created.paymentId
      intentId = (await scalar(`SELECT processor_payment_id FROM dues_transactions WHERE id = $1`, [paymentId])).processor_payment_id
    })

    it('a tampered amount, member, organization or provider reference never credits the ledger', async () => {
      await expect(settle('evt_amount', { amount_received: 1 })).rejects.toMatchObject({ code: 'AMOUNT_MISMATCH' })
      await expect(settle('evt_ref', { id: 'pi_someone_elses' })).rejects.toMatchObject({ code: 'PROVIDER_REFERENCE_MISMATCH' })
      await expect(settle('evt_member', { metadata: { ue_dues_payment_id: paymentId, organization_id: ORG_A, member_user_id: 'someone-else' } })).rejects.toMatchObject({ code: 'MEMBER_MISMATCH' })
      await expect(settle('evt_org', { metadata: { ue_dues_payment_id: paymentId, organization_id: ORG_B, member_user_id: MEMBER } })).rejects.toMatchObject({ code: 'ORGANIZATION_MISMATCH' })
      expect(await ledgerRows()).toEqual([])
      expect((await scalar(`SELECT status FROM dues_transactions WHERE id = $1`, [paymentId])).status).toBe('pending')
    })

    it('ten simultaneous deliveries of the same payment (distinct event ids) credit the ledger once', async () => {
      const outcomes = await Promise.all(Array.from({ length: 10 }, (_v, i) => settle(`evt_${i}`)))
      expect(outcomes.filter((o) => o === 'settled')).toHaveLength(1)
      expect(outcomes.filter((o) => o === 'duplicate')).toHaveLength(9)
      const rows = await ledgerRows()
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ amount: '30.00', payment_reference: intentId })
      expect((await scalar(`SELECT status FROM dues_transactions WHERE id = $1`, [paymentId])).status).toBe('paid')
      expect(state.audit.filter((e) => e.action === 'dues.settle')).toHaveLength(1)
    })

    it('a delayed replay long after settlement, and a replay with the same event id, change nothing', async () => {
      expect(await settle('evt_late')).toBe('duplicate')
      expect(await settle('evt_0')).toBe('duplicate')
      expect(await ledgerRows()).toHaveLength(1)
    })

    it('a provider failure arriving after settlement does not reverse or re-open it', async () => {
      const { recordDuesPaymentProviderOutcome } = await import('../../lib/dues/dues-settlement')
      const pi = await intent()
      const outcome = await inRole('union_eyes_system', null, (tx) => recordDuesPaymentProviderOutcome(tx as never, pi as never, 'evt_fail', 'failed'))
      expect(outcome).toBe('ignored')
      expect((await scalar(`SELECT status FROM dues_transactions WHERE id = $1`, [paymentId])).status).toBe('paid')
    })
  })

  describe('rewards and pilot telemetry rows', () => {
    it('the runtime role in ORG_B sees none of ORG_A\'s recognition awards or pilot events, with or without a predicate', async () => {
      const program = randomUUID()
      const awardType = randomUUID()
      await admin.query(`INSERT INTO recognition_programs (id, org_id, name) VALUES ($1, $2, 'program')`, [program, ORG_A])
      await admin.query(`INSERT INTO recognition_award_types (id, org_id, program_id, name, kind, default_credit_amount) VALUES ($1, $2, $3, 'Work Anniversary', 'automated', 5)`, [awardType, ORG_A, program])
      await admin.query(`INSERT INTO recognition_awards (id, org_id, program_id, award_type_id, recipient_user_id, reason) VALUES (gen_random_uuid(), $1, $2, $3, 'member-1', 'r')`, [ORG_A, program, awardType])
      await admin.query(`INSERT INTO pilot_events (organization_id, user_id, session_id, event_type) VALUES ($1, 'u1', 's1', 'login')`, [ORG_A])
      const q = (sqlText: string) => inRole('union_eyes_runtime', ORG_B, (tx) => (tx as unknown as { $client: pg.Client }).$client.query(sqlText)) as Promise<pg.QueryResult>
      expect((await q('SELECT id FROM recognition_awards')).rows).toEqual([])
      expect((await q(`SELECT id FROM pilot_events WHERE organization_id = '${ORG_A}'`)).rows).toEqual([])
      const own = (await inRole('union_eyes_runtime', ORG_A, (tx) => (tx as unknown as { $client: pg.Client }).$client.query('SELECT id FROM recognition_awards'))) as pg.QueryResult
      expect(own.rows).toHaveLength(1)
    })
  })

  describe('pension retirement eligibility', () => {
    it('as the runtime role, lists only the caller organization\'s enrolments, projected, and audits the read', async () => {
      const plan = randomUUID()
      const enrol = (org: string, name: string, years: string) =>
        admin.query(
          `INSERT INTO pension_members (id, organization_id, plan_id, user_id, name, plan_name, years_of_service, metadata)
           VALUES (gen_random_uuid(), $1, $2, gen_random_uuid(), $3, 'Plan', $4, '{"sin":"123-456-789"}')`,
          [org, plan, name, years],
        )
      await enrol(ORG_A, 'Alice A', '31.0')
      await enrol(ORG_A, 'Bob A', '5.0')
      await enrol(ORG_B, 'Zed B', '44.0')
      const { GET } = await import('../../app/api/pension/retirement-eligibility/route')
      const call = (organizationId: string, threshold: string) =>
        (GET as unknown as (c: unknown) => Promise<{ data: Array<Record<string, unknown>> }>)({
          request: new Request(`http://localhost/api/pension/retirement-eligibility${threshold}`),
          organizationId,
          userId: 'officer-1',
        })
      await expect(call(ORG_A, '')).rejects.toMatchObject({ status: 400 })
      await expect(call(ORG_A, '?threshold=0')).rejects.toMatchObject({ status: 400 })
      await expect(call(ORG_A, '?threshold=61')).rejects.toMatchObject({ status: 400 })
      const asA = await call(ORG_A, '?threshold=25')
      expect(asA.data.map((r) => r.name)).toEqual(['Alice A'])
      expect(JSON.stringify(asA)).not.toContain('123-456-789')
      expect((await call(ORG_A, '?threshold=1')).data.map((r) => r.name)).toEqual(['Alice A', 'Bob A'])
      expect((await call(ORG_B, '?threshold=25')).data.map((r) => r.name)).toEqual(['Zed B'])
      expect(state.audit.map((e) => e.action)).toEqual(Array(3).fill('pension.retirement_eligibility.read'))
      expect(state.audit[0]).toMatchObject({ organizationId: ORG_A, userId: 'officer-1' })
    })
  })
})
