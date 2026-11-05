import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'

const dialect = new PgDialect()
const statements: { sql: string; params: unknown[] }[] = []
let balance = '25.00'
let openPayments: Array<{ id: string; amount: string; processor_payment_id: string | null; within_retry_window: boolean }> = []
let linkAccepted = true

vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: vi.fn(async () => undefined) }))
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_context: unknown, operation: (tx: unknown) => Promise<unknown>) =>
    operation({
      execute: async (query: Parameters<PgDialect['sqlToQuery']>[0]) => {
        const compiled = dialect.sqlToQuery(query)
        statements.push(compiled)
        if (/SELECT COALESCE/.test(compiled.sql)) return [{ balance }]
        if (/SELECT id::text AS id, amount::text AS amount, processor_payment_id/.test(compiled.sql)) return openPayments
        if (/INSERT INTO dues_transactions/.test(compiled.sql)) return [{ id: 'pay-1' }]
        if (/UPDATE dues_transactions SET processor_payment_id/.test(compiled.sql)) {
          return linkAccepted ? [{ id: 'pay-1' }] : []
        }
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
    openPayments = []
    linkAccepted = true
  })

  it('creates a pending payment and a provider intent whose amount and identity the server owns', async () => {
    const create = vi.fn(async () => ({ id: 'pi_1', client_secret: 'secret_1' }))
    const result = await initiateDuesPayment({
      ...base,
      gateway: { paymentIntents: { create } },
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
        gateway: { paymentIntents: { create } },
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
        gateway: { paymentIntents: { create } },
        providerConfigured: false,
      }),
    ).rejects.toBeInstanceOf(DuesInitiationError)
    expect(statements).toHaveLength(0)
  })

  it('preserves the pending payment after an ambiguous provider failure', async () => {
    const create = vi.fn(async () => {
      throw new Error('stripe_down')
    })
    await expect(
      initiateDuesPayment({
        ...base,
        gateway: { paymentIntents: { create } },
        providerConfigured: true,
      }),
    ).rejects.toThrow('stripe_down')
    expect(statements.some((s) => /status = 'cancelled'/.test(s.sql))).toBe(false)
    expect(statements.some((s) => /INSERT INTO dues_transactions/.test(s.sql))).toBe(true)
  })
  it('reuses a verified linked provider intent without creating another', async () => {
    openPayments = [{ id: 'pay-1', amount: '25.00', processor_payment_id: 'pi_existing', within_retry_window: false }]
    const create = vi.fn()
    const retrieve = vi.fn(async () => ({
      id: 'pi_existing', client_secret: 'secret_existing', amount: 2500, currency: 'cad',
      status: 'requires_payment_method',
      metadata: {
        ue_payment_kind: 'member_dues', ue_dues_payment_id: 'pay-1',
        organization_id: base.organizationId, member_user_id: base.userId,
      },
    }))
    const result = await initiateDuesPayment({
      ...base, providerConfigured: true, gateway: { paymentIntents: { create, retrieve } },
    })
    expect(result).toMatchObject({ paymentId: 'pay-1', paymentIntentId: 'pi_existing', clientSecret: 'secret_existing' })
    expect(retrieve).toHaveBeenCalledWith('pi_existing')
    expect(create).not.toHaveBeenCalled()
    expect(statements.some((s) => /INSERT INTO dues_transactions/.test(s.sql))).toBe(false)
  })

  it('refuses changed balance without cancelling a chargeable intent', async () => {
    balance = '30.00'
    openPayments = [{ id: 'pay-1', amount: '25.00', processor_payment_id: 'pi_existing', within_retry_window: true }]
    const create = vi.fn()
    const cancel = vi.fn()
    await expect(initiateDuesPayment({
      ...base, providerConfigured: true, gateway: { paymentIntents: { create, cancel } },
    })).rejects.toMatchObject({ code: 'PENDING_PAYMENT_REQUIRES_RECONCILIATION' })
    expect(create).not.toHaveBeenCalled()
    expect(cancel).not.toHaveBeenCalled()
    expect(statements.some((s) => /UPDATE dues_transactions/.test(s.sql))).toBe(false)
  })

  it('refuses multiple pending payments without superseding them', async () => {
    openPayments = [
      { id: 'pay-1', amount: '25.00', processor_payment_id: 'pi_one', within_retry_window: true },
      { id: 'pay-2', amount: '25.00', processor_payment_id: null, within_retry_window: true },
    ]
    const create = vi.fn()
    await expect(initiateDuesPayment({
      ...base, providerConfigured: true, gateway: { paymentIntents: { create } },
    })).rejects.toMatchObject({ code: 'PENDING_PAYMENT_REQUIRES_RECONCILIATION' })
    expect(create).not.toHaveBeenCalled()
  })

  it('refuses unlinked intents outside the bounded retry window', async () => {
    openPayments = [{ id: 'pay-1', amount: '25.00', processor_payment_id: null, within_retry_window: false }]
    const create = vi.fn()
    await expect(initiateDuesPayment({
      ...base, providerConfigured: true, gateway: { paymentIntents: { create } },
    })).rejects.toMatchObject({ code: 'PENDING_PAYMENT_REQUIRES_RECONCILIATION' })
    expect(create).not.toHaveBeenCalled()
  })

  it('reuses the same internal idempotency key for a recent unlinked intent', async () => {
    openPayments = [{ id: 'pay-existing', amount: '25.00', processor_payment_id: null, within_retry_window: true }]
    const create = vi.fn(async () => ({ id: 'pi_existing', client_secret: 'secret_existing' }))
    const result = await initiateDuesPayment({
      ...base, providerConfigured: true, gateway: { paymentIntents: { create } },
    })
    expect(result.paymentId).toBe('pay-existing')
    expect(create).toHaveBeenCalledWith(expect.any(Object), { idempotencyKey: 'ue-dues-pay-existing' })
    expect(statements.some((s) => /INSERT INTO dues_transactions/.test(s.sql))).toBe(false)
  })

  it('refuses provider reuse when retrieval is unavailable or its identity differs', async () => {
    openPayments = [{ id: 'pay-1', amount: '25.00', processor_payment_id: 'pi_existing', within_retry_window: true }]
    const create = vi.fn()
    await expect(initiateDuesPayment({
      ...base, providerConfigured: true, gateway: { paymentIntents: { create } },
    })).rejects.toMatchObject({ code: 'PENDING_PAYMENT_REQUIRES_RECONCILIATION' })
    const retrieve = vi.fn(async () => ({
      id: 'pi_existing', client_secret: 'secret', amount: 2500, currency: 'cad',
      status: 'requires_payment_method', metadata: { organization_id: 'foreign' },
    }))
    await expect(initiateDuesPayment({
      ...base, providerConfigured: true, gateway: { paymentIntents: { create, retrieve } },
    })).rejects.toMatchObject({ code: 'PENDING_PAYMENT_REQUIRES_RECONCILIATION' })
    expect(create).not.toHaveBeenCalled()
  })

  it('refuses to claim provider-link success when the guarded update loses the race', async () => {
    linkAccepted = false
    const create = vi.fn(async () => ({ id: 'pi_1', client_secret: 'secret_1' }))
    await expect(initiateDuesPayment({
      ...base, providerConfigured: true, gateway: { paymentIntents: { create } },
    })).rejects.toMatchObject({ code: 'PENDING_PAYMENT_REQUIRES_RECONCILIATION' })
    expect(create).toHaveBeenCalledTimes(1)
  })

})
