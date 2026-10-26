import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'

const { audit } = vi.hoisted(() => ({ audit: vi.fn(async () => true) }))
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: audit }))

import {
  DuesSettlementError,
  isDuesPaymentIntent,
  recordDuesPaymentProviderOutcome,
  settleDuesPaymentIntent,
} from '../dues-settlement'

const dialect = new PgDialect()
const PAYMENT_ID = '11111111-1111-4111-8111-111111111111'
const ORG = '22222222-2222-4222-8222-222222222222'
const MEMBER = 'user-text-id-1'

interface Row {
  id: string
  organization_id: string
  member_id: string
  amount: string
  status: string
  processor_payment_id: string | null
}

function simulator(initial: Partial<Row> = {}) {
  const row: Row = {
    id: PAYMENT_ID,
    organization_id: ORG,
    member_id: MEMBER,
    amount: '25.00',
    status: 'pending',
    processor_payment_id: 'pi_test_1',
    ...initial,
  }
  const ledger: Record<string, unknown>[] = []
  const tx = {
    execute: async (query: Parameters<PgDialect['sqlToQuery']>[0]) => {
      const { sql, params } = dialect.sqlToQuery(query)
      if (/FOR UPDATE/.test(sql)) return params[0] === row.id ? [{ ...row }] : []
      if (/^\s*UPDATE dues_transactions\s+SET status = 'paid'/.test(sql)) {
        if (row.status !== 'pending') return []
        row.status = 'paid'
        return [{ id: row.id }]
      }
      if (/^\s*UPDATE dues_transactions SET status = \$1/.test(sql)) {
        if (row.status === 'pending') row.status = String(params[0])
        return []
      }
      if (/SELECT COALESCE/.test(sql)) return [{ balance: '25.00' }]
      if (/INSERT INTO member_dues_ledger/.test(sql)) {
        ledger.push({ params })
        return [{ id: 'ledger-1' }]
      }
      throw new Error(`unexpected statement: ${sql.slice(0, 80)}`)
    },
  }
  return { tx: tx as never, row, ledger }
}

const intent = (overrides: Record<string, unknown> = {}) => ({
  id: 'pi_test_1',
  amount: 2500,
  amount_received: 2500,
  currency: 'cad',
  metadata: {
    ue_payment_kind: 'member_dues',
    ue_dues_payment_id: PAYMENT_ID,
    organization_id: ORG,
    member_user_id: MEMBER,
  },
  ...overrides,
})

describe('dues settlement authority', () => {
  beforeEach(() => audit.mockClear())

  it('recognizes only dues payment intents', () => {
    expect(isDuesPaymentIntent(intent())).toBe(true)
    expect(isDuesPaymentIntent({ id: 'pi_x', metadata: { organization_id: ORG } })).toBe(false)
  })

  it('settles a verified pending payment once: status, ledger credit and audit together', async () => {
    const sim = simulator()
    expect(await settleDuesPaymentIntent(sim.tx, intent(), 'evt_1')).toBe('settled')
    expect(sim.row.status).toBe('paid')
    expect(sim.ledger).toHaveLength(1)
    expect(audit).toHaveBeenCalledWith(
      sim.tx,
      expect.objectContaining({
        organizationId: ORG,
        action: 'dues.settle',
        resourceId: PAYMENT_ID,
      }),
    )
  })

  it('does not credit twice on a duplicate delivery', async () => {
    const sim = simulator()
    await settleDuesPaymentIntent(sim.tx, intent(), 'evt_1')
    expect(await settleDuesPaymentIntent(sim.tx, intent(), 'evt_1_retry')).toBe('duplicate')
    expect(sim.ledger).toHaveLength(1)
    expect(audit).toHaveBeenCalledTimes(1)
  })

  it.each([
    [
      'foreign organization',
      {
        metadata: {
          ue_payment_kind: 'member_dues',
          ue_dues_payment_id: PAYMENT_ID,
          organization_id: '33333333-3333-4333-8333-333333333333',
          member_user_id: MEMBER,
        },
      },
      'ORGANIZATION_MISMATCH',
    ],
    [
      'another member',
      {
        metadata: {
          ue_payment_kind: 'member_dues',
          ue_dues_payment_id: PAYMENT_ID,
          organization_id: ORG,
          member_user_id: 'someone-else',
        },
      },
      'MEMBER_MISMATCH',
    ],
    ['tampered amount', { amount_received: 1, amount: 1 }, 'AMOUNT_MISMATCH'],
    ['wrong currency', { currency: 'usd' }, 'CURRENCY_MISMATCH'],
    ['different payment intent', { id: 'pi_other' }, 'PROVIDER_REFERENCE_MISMATCH'],
  ])('denies %s and credits nothing', async (_name, override, code) => {
    const sim = simulator()
    await expect(settleDuesPaymentIntent(sim.tx, intent(override), 'evt_x')).rejects.toMatchObject({
      code,
    })
    expect(sim.row.status).toBe('pending')
    expect(sim.ledger).toHaveLength(0)
    expect(audit).not.toHaveBeenCalled()
  })

  it('denies an unknown internal payment reference', async () => {
    const sim = simulator()
    const unknown = intent({
      metadata: {
        ue_payment_kind: 'member_dues',
        ue_dues_payment_id: '44444444-4444-4444-8444-444444444444',
        organization_id: ORG,
        member_user_id: MEMBER,
      },
    })
    await expect(settleDuesPaymentIntent(sim.tx, unknown, 'evt_x')).rejects.toBeInstanceOf(
      DuesSettlementError,
    )
    expect(sim.ledger).toHaveLength(0)
  })

  it('refuses to settle a payment that is already failed or cancelled', async () => {
    const sim = simulator({ status: 'cancelled' })
    await expect(settleDuesPaymentIntent(sim.tx, intent(), 'evt_x')).rejects.toMatchObject({
      code: 'INVALID_STATE',
    })
    expect(sim.ledger).toHaveLength(0)
  })

  it('records provider failure without crediting the ledger', async () => {
    const sim = simulator()
    expect(await recordDuesPaymentProviderOutcome(sim.tx, intent(), 'evt_f', 'failed')).toBe(
      'recorded',
    )
    expect(sim.row.status).toBe('failed')
    expect(sim.ledger).toHaveLength(0)
    expect(audit).toHaveBeenCalledWith(
      sim.tx,
      expect.objectContaining({ action: 'dues.payment_failed' }),
    )
  })
})
