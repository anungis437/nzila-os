import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'

const dialect = new PgDialect()
const statements: { sql: string; params: unknown[] }[] = []
let balance = '25.00'

vi.mock('@/lib/audit/mandatory-audit', () => ({ appendMandatoryAudit: vi.fn(async () => true) }))
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_context: unknown, operation: (tx: unknown) => Promise<unknown>) =>
    operation({
      execute: async (query: Parameters<PgDialect['sqlToQuery']>[0]) => {
        const compiled = dialect.sqlToQuery(query)
        statements.push(compiled)
        if (/SELECT COALESCE/.test(compiled.sql)) return [{ balance }]
        if (/INSERT INTO dues_transactions/.test(compiled.sql)) return [{ id: 'pay-1' }]
        return []
      },
    }),
}))

import { DuesInitiationError, initiateDuesPayment } from '../dues-payment-service'

const base = { organizationId: 'org-1', userId: 'user-1' }

describe('initiateDuesPayment', () => {
  beforeEach(() => {
    statements.length = 0
    balance = '25.00'
  })

  it('creates a pending payment and a provider intent whose amount and identity the server owns', async () => {
    const create = vi.fn(async () => ({ id: 'pi_1', client_secret: 'secret_1' }))
    const result = await initiateDuesPayment({
      ...base,
      stripe: { paymentIntents: { create } },
      providerConfigured: true,
    })
    expect(result).toMatchObject({
      paymentId: 'pay-1',
      paymentIntentId: 'pi_1',
      amount: '25.00',
      currency: 'cad',
    })
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2500,
        currency: 'cad',
        metadata: expect.objectContaining({
          ue_payment_kind: 'member_dues',
          ue_dues_payment_id: 'pay-1',
          organization_id: 'org-1',
          member_user_id: 'user-1',
        }),
      }),
      { idempotencyKey: 'ue-dues-pay-1' },
    )
    expect(statements.some((s) => /INSERT INTO member_dues_ledger/.test(s.sql))).toBe(false)
  })

  it('refuses when nothing is due', async () => {
    balance = '0'
    const create = vi.fn()
    await expect(
      initiateDuesPayment({
        ...base,
        stripe: { paymentIntents: { create } },
        providerConfigured: true,
      }),
    ).rejects.toMatchObject({ code: 'NOTHING_DUE' })
    expect(create).not.toHaveBeenCalled()
  })

  it('fails safely when the provider is not configured, creating nothing', async () => {
    const create = vi.fn()
    await expect(
      initiateDuesPayment({
        ...base,
        stripe: { paymentIntents: { create } },
        providerConfigured: false,
      }),
    ).rejects.toBeInstanceOf(DuesInitiationError)
    expect(statements).toHaveLength(0)
  })

  it('cancels the pending payment when the provider call fails', async () => {
    const create = vi.fn(async () => {
      throw new Error('stripe_down')
    })
    await expect(
      initiateDuesPayment({
        ...base,
        stripe: { paymentIntents: { create } },
        providerConfigured: true,
      }),
    ).rejects.toThrow('stripe_down')
    expect(statements.some((s) => /status = 'cancelled'/.test(s.sql))).toBe(true)
  })
})
