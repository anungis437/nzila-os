import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'

// DEF-0B11-PRP-DUES-PAY-POST-CREATES-A-NEW-FULL-BALANCE-PAYMENT-AND-INTENT-ON-EVERY-CALL-AND-SETTLEMENT-DOES-NOT-RECHECK-THE-BALANCE
// Real SQL, two members: repeated or concurrent initiation yields one open payment per member.

const state = vi.hoisted(() => ({ db: null as unknown, audit: [] as Array<Record<string, unknown>> }))

vi.mock('@/lib/audit/atomic-audit', () => ({
  persistAtomicAudit: async (_tx: unknown, entry: Record<string, unknown>) => {
    state.audit.push(entry)
  },
}))
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_context: unknown, operation: (tx: unknown) => Promise<unknown>) => {
    // A real transaction: callers queue on the single connection, as they queue on the advisory lock in Postgres.
    const db = state.db as { transaction<T>(fn: (tx: { execute(q: unknown): Promise<{ rows: unknown[] }> }) => Promise<T>): Promise<T> }
    return db.transaction(async (tx) => operation({ execute: async (query: unknown) => (await tx.execute(query)).rows }))
  },
}))

import { initiateDuesPayment } from '../dues-payment-service'
import { settleDuesPaymentIntent } from '../dues-settlement'

const ORG = '11111111-1111-4111-8111-111111111111'
let pg: PGlite
let intentSeq = 0

const gateway = () => {
  const create = vi.fn(async (_params: Record<string, unknown>, options?: Record<string, unknown>) => ({
    id: `pi_${String(options?.idempotencyKey)}`,
    client_secret: `secret_${intentSeq++}`,
  }))
  const cancel = vi.fn(async () => ({}))
  return { create, cancel, facade: { paymentIntents: { create, cancel } } }
}

const initiate = (userId: string, g: ReturnType<typeof gateway>) =>
  initiateDuesPayment({ organizationId: ORG, userId, gateway: g.facade, providerConfigured: true })

const rows = async (where = '') =>
  (await pg.query<{ id: string; member_id: string; status: string; amount: string; processor_payment_id: string | null }>(
    `SELECT id::text AS id, member_id, status, amount::text AS amount, processor_payment_id FROM dues_transactions ${where} ORDER BY created_at, id`,
  )).rows

const charge = (userId: string, amount: number) =>
  pg.query(
    `INSERT INTO member_dues_ledger (organization_id, user_id, transaction_type, amount, status) VALUES ($1::uuid, $2, 'charge', $3, 'posted')`,
    [ORG, userId, amount],
  )

beforeAll(async () => {
  const { PGlite: Engine } = await import('@electric-sql/pglite')
  pg = new Engine()
  state.db = drizzle(pg)
  await pg.exec(`
    CREATE TABLE member_dues_ledger (
      id uuid primary key default gen_random_uuid(), organization_id uuid not null, user_id text not null,
      transaction_type text not null, transaction_date timestamptz default now(), effective_date timestamptz default now(),
      amount numeric not null, balance_before numeric, balance_after numeric, payment_method text, payment_reference text,
      reference_type text, reference_id uuid, description text, status text not null default 'posted', created_by text, metadata jsonb);
    CREATE TABLE dues_transactions (
      id uuid primary key default gen_random_uuid(), organization_id uuid not null, member_id text not null,
      transaction_type text, amount numeric not null, period_start date, period_end date, due_date date,
      status text not null, processor_type text, dues_amount numeric, total_amount numeric, metadata jsonb,
      processor_payment_id text, payment_date timestamptz, paid_date timestamptz, payment_reference text,
      created_at timestamptz default now(), updated_at timestamptz default now());
  `)
})

afterAll(async () => { await pg.close() })

beforeEach(async () => {
  state.audit.length = 0
  await pg.exec('TRUNCATE member_dues_ledger, dues_transactions')
  await charge('member-a', 25)
  await charge('member-b', 40)
})

describe('initiateDuesPayment — one open payment per member', () => {
  it('returns the same payment for a repeated call instead of inserting another full-balance payment', async () => {
    const g = gateway()
    const first = await initiate('member-a', g)
    const second = await initiate('member-a', g)
    const third = await initiate('member-a', g)

    expect(second.paymentId).toBe(first.paymentId)
    expect(third.paymentId).toBe(first.paymentId)
    expect(await rows(`WHERE member_id = 'member-a'`)).toHaveLength(1)
    // The provider is asked with the same idempotency key every time, so it replays one intent.
    const keys = g.create.mock.calls.map((call) => (call[1] as { idempotencyKey: string }).idempotencyKey)
    expect(new Set(keys)).toEqual(new Set([`ue-dues-${first.paymentId}`]))
    expect(state.audit.filter((e) => e.action === 'dues.payment_initiated')).toHaveLength(1)
  })

  it('creates one payment when the calls are concurrent', async () => {
    const g = gateway()
    const results = await Promise.all([initiate('member-a', g), initiate('member-a', g), initiate('member-a', g)])
    expect(new Set(results.map((r) => r.paymentId)).size).toBe(1)
    expect(await rows(`WHERE member_id = 'member-a'`)).toHaveLength(1)
  })

  it('keeps members separate', async () => {
    const g = gateway()
    const a = await initiate('member-a', g)
    const b = await initiate('member-b', g)
    expect(a.paymentId).not.toBe(b.paymentId)
    expect(a.amount).toBe('25.00')
    expect(b.amount).toBe('40.00')
  })

  it('cancels the open payment and its provider intent when the balance has changed, and opens a new one', async () => {
    const g = gateway()
    const first = await initiate('member-a', g)
    await charge('member-a', 10)
    const second = await initiate('member-a', g)

    expect(second.paymentId).not.toBe(first.paymentId)
    expect(second.amount).toBe('35.00')
    const all = await rows(`WHERE member_id = 'member-a'`)
    expect(all.find((r) => r.id === first.paymentId)?.status).toBe('cancelled')
    expect(all.filter((r) => r.status === 'pending')).toHaveLength(1)
    expect(g.cancel).toHaveBeenCalledWith(first.paymentIntentId)
  })

  it('opens nothing for a member with nothing due', async () => {
    const g = gateway()
    await expect(initiate('member-without-dues', g)).rejects.toMatchObject({ code: 'NOTHING_DUE' })
    expect(await rows()).toHaveLength(0)
  })

  // F06 A3: the initiation record says a payment was opened; what the provider then did is recorded as its own state change.
  it('records the provider intent link in the same transaction as the update that stores it', async () => {
    const g = gateway()
    const result = await initiate('member-a', g)

    const linked = state.audit.filter((e) => e.action === 'dues.payment_provider_intent_linked')
    expect(linked).toHaveLength(1)
    expect(linked[0]).toMatchObject({ resourceId: result.paymentId, details: { paymentIntentId: result.paymentIntentId, currency: 'cad' } })
    expect((await rows(`WHERE member_id = 'member-a'`))[0].processor_payment_id).toBe(result.paymentIntentId)
  })

  it('records the cancellation when the provider creates nothing, and the member can try again', async () => {
    const failing = { create: vi.fn(async () => { throw new Error('stripe_down') }), cancel: vi.fn() }
    await expect(
      initiateDuesPayment({ organizationId: ORG, userId: 'member-a', gateway: { paymentIntents: failing }, providerConfigured: true }),
    ).rejects.toThrow('stripe_down')

    const [row] = await rows(`WHERE member_id = 'member-a'`)
    expect(row.status).toBe('cancelled')
    const cancelled = state.audit.filter((e) => e.action === 'dues.payment_cancelled')
    expect(cancelled).toHaveLength(1)
    expect(cancelled[0]).toMatchObject({ resourceId: row.id, details: { reason: 'provider_intent_not_created' } })

    const retry = await initiate('member-a', gateway())
    expect(retry.paymentId).not.toBe(row.id)
  })

  it('keeps the payment pending when the provider holds a payable intent that could not be linked, and a repeat reuses it', async () => {
    const g = gateway()
    const originalExecute = (state.db as { transaction: unknown }).transaction
    let failLink = true
    ;(state.db as { transaction: unknown }).transaction = (fn: (tx: { execute(q: unknown): Promise<{ rows: unknown[] }> }) => Promise<unknown>) =>
      (originalExecute as (f: typeof fn) => Promise<unknown>).call(state.db, async (tx) =>
        fn({
          execute: async (q: unknown) => {
            const text = JSON.stringify((q as { queryChunks?: unknown }).queryChunks ?? '')
            if (failLink && text.includes('processor_payment_id =')) {
              failLink = false
              throw new Error('link failed')
            }
            return tx.execute(q)
          },
        }),
      )
    try {
      await expect(initiate('member-a', g)).rejects.toThrow('link failed')
    } finally {
      ;(state.db as { transaction: unknown }).transaction = originalExecute
    }

    const [pendingRow] = await rows(`WHERE member_id = 'member-a'`)
    expect(pendingRow.status).toBe('pending')
    expect(state.audit.some((e) => e.action === 'dues.payment_cancelled')).toBe(false)

    const repeat = await initiate('member-a', g)
    expect(repeat.paymentId).toBe(pendingRow.id)
    const keys = new Set(g.create.mock.calls.map((call) => (call[1] as { idempotencyKey: string }).idempotencyKey))
    expect(keys).toEqual(new Set([`ue-dues-${pendingRow.id}`]))
  })

  it('records the cancellation of a superseded payment', async () => {
    const g = gateway()
    const first = await initiate('member-a', g)
    await charge('member-a', 10)
    await initiate('member-a', g)

    const superseded = state.audit.filter((e) => e.action === 'dues.payment_cancelled')
    expect(superseded).toHaveLength(1)
    expect(superseded[0]).toMatchObject({ resourceId: first.paymentId, details: { reason: 'superseded_by_new_balance' } })
  })
})

describe('settleDuesPaymentIntent — a payment beyond the balance is recorded, not hidden', () => {
  const pi = (paymentId: string, id: string) => ({
    id,
    amount: 2500,
    amount_received: 2500,
    currency: 'cad',
    metadata: { ue_payment_kind: 'member_dues', ue_dues_payment_id: paymentId, organization_id: ORG, member_user_id: 'member-a' },
  })
  const legacyPending = async (processorId: string) =>
    (await pg.query<{ id: string }>(
      `INSERT INTO dues_transactions (organization_id, member_id, transaction_type, amount, status, processor_type, processor_payment_id, metadata)
       VALUES ($1::uuid, 'member-a', 'payment', 25, 'pending', 'stripe', $2, '{"kind":"member_dues"}'::jsonb) RETURNING id::text AS id`,
      [ORG, processorId],
    )).rows[0].id

  it('flags the overpayment in the audit record when a second payment settles after the balance is cleared', async () => {
    const tx = { execute: async (q: unknown) => ((state.db as { execute(q: unknown): Promise<{ rows: unknown[] }> }).execute(q)).then((r) => r.rows) }
    const first = await legacyPending('pi_first')
    const second = await legacyPending('pi_second')

    await expect(settleDuesPaymentIntent(tx as never, pi(first, 'pi_first'), 'evt_1')).resolves.toBe('settled')
    await expect(settleDuesPaymentIntent(tx as never, pi(second, 'pi_second'), 'evt_2')).resolves.toBe('settled')

    const settleAudits = state.audit.filter((e) => e.action === 'dues.settle')
    expect(settleAudits[0].details).not.toHaveProperty('overpaidCents')
    expect(settleAudits[1].details).toMatchObject({ overpaidCents: 2500, paymentIntentId: 'pi_second' })
    // Exactly-once still holds: replaying an event settles nothing further.
    await expect(settleDuesPaymentIntent(tx as never, pi(second, 'pi_second'), 'evt_2')).resolves.toBe('duplicate')
  })
})
