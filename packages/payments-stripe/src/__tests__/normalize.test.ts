import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── DB + ORM mocks ──────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  const mockInsert = vi.fn().mockReturnThis()
  const mockValues = vi.fn().mockReturnThis()
  const mockUpdate = vi.fn().mockReturnThis()
  const mockSet = vi.fn().mockReturnThis()
  const mockWhere = vi.fn().mockResolvedValue(undefined)
  const mockSelect = vi.fn().mockReturnThis()
  const mockFrom = vi.fn().mockReturnThis()
  const mockLimit = vi.fn().mockResolvedValue([{ id: 'pay_db_1' }])
  return { mockInsert, mockValues, mockUpdate, mockSet, mockWhere, mockSelect, mockFrom, mockLimit }
})

vi.mock('@nzila/db', () => ({
  db: {
    insert: mocks.mockInsert,
    update: mocks.mockUpdate,
    select: mocks.mockSelect,
  },
}))

vi.mock('@nzila/db/schema', () => ({
  stripePayments: { id: 'id', stripeObjectId: 'stripeObjectId' },
  stripeRefunds: {},
  stripeDisputes: {},
  stripePayouts: {},
  stripeWebhookEvents: { id: 'id' },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
}))

import { normalizeAndPersist } from '../normalize'
import type Stripe from 'stripe'

// ── Helpers ─────────────────────────────────────────────────────────────────

function fakeEvent(type: string, obj: Record<string, unknown>, created = 1710000000): Stripe.Event {
  return {
    id: 'evt_test',
    type,
    data: { object: obj },
    created,
  } as unknown as Stripe.Event
}

describe('normalizeAndPersist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Re-wire chains after clearAllMocks
    mocks.mockInsert.mockReturnValue({ values: mocks.mockValues })
    mocks.mockUpdate.mockReturnValue({ set: mocks.mockSet })
    mocks.mockSet.mockReturnValue({ where: mocks.mockWhere })
    mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom })
    mocks.mockFrom.mockReturnValue({ where: vi.fn().mockReturnValue({ limit: mocks.mockLimit }) })
  })

  it('skips unsupported event types', async () => {
    const event = fakeEvent('customer.updated', { id: 'cus_1' })
    const result = await normalizeAndPersist(event, 'wh_1', 'org_1')
    expect(result.kind).toBe('skipped')
    if (result.kind === 'skipped') {
      expect(result.reason).toContain('Unsupported event type')
    }
    expect(mocks.mockInsert).not.toHaveBeenCalled()
  })

  it('normalizes checkout.session.completed', async () => {
    const event = fakeEvent('checkout.session.completed', {
      id: 'cs_1',
      status: 'complete',
      amount_total: 5000,
      currency: 'cad',
      metadata: { venture_id: 'v1' },
    })

    const result = await normalizeAndPersist(event, 'wh_1', 'org_1')

    expect(result.kind).toBe('payment')
    if (result.kind === 'payment') {
      expect(result.data.stripeObjectId).toBe('cs_1')
      expect(result.data.objectType).toBe('checkout_session')
      expect(result.data.amountCents).toBe(BigInt(5000))
      expect(result.data.currency).toBe('CAD')
      expect(result.data.ventureId).toBe('v1')
    }
    expect(mocks.mockInsert).toHaveBeenCalled()
  })

  it('normalizes payment_intent.succeeded', async () => {
    const event = fakeEvent('payment_intent.succeeded', {
      id: 'pi_1',
      status: 'succeeded',
      amount: 3000,
      currency: 'usd',
      metadata: {},
    })

    const result = await normalizeAndPersist(event, 'wh_2', 'org_1')

    expect(result.kind).toBe('payment')
    if (result.kind === 'payment') {
      expect(result.data.objectType).toBe('payment_intent')
      expect(result.data.amountCents).toBe(BigInt(3000))
      expect(result.data.currency).toBe('USD')
    }
  })

  it('normalizes payment_intent.payment_failed', async () => {
    const event = fakeEvent('payment_intent.payment_failed', {
      id: 'pi_fail',
      status: 'requires_payment_method',
      amount: 1000,
      currency: 'cad',
      metadata: {},
    })

    const result = await normalizeAndPersist(event, 'wh_3', 'org_1')

    expect(result.kind).toBe('payment')
    if (result.kind === 'payment') {
      expect(result.data.status).toBe('requires_payment_method')
    }
  })

  it('normalizes charge.refunded', async () => {
    const event = fakeEvent('charge.refunded', {
      id: 'ch_1',
      payment_intent: 'pi_1',
      refunds: {
        data: [
          { id: 're_1', amount: 2000, status: 'succeeded', created: 1710000000 },
        ],
      },
    })

    const result = await normalizeAndPersist(event, 'wh_4', 'org_1')

    expect(result.kind).toBe('refund')
    if (result.kind === 'refund') {
      expect(result.data.refundId).toBe('re_1')
      expect(result.data.amountCents).toBe(BigInt(2000))
      expect(result.data.paymentStripeObjectId).toBe('pi_1')
    }
  })

  it('skips charge.refunded with no refund data', async () => {
    const event = fakeEvent('charge.refunded', {
      id: 'ch_2',
      payment_intent: 'pi_2',
      refunds: { data: [] },
    })

    const result = await normalizeAndPersist(event, 'wh_5', 'org_1')
    expect(result.kind).toBe('skipped')
  })

  it('normalizes charge.dispute.created', async () => {
    const event = fakeEvent('charge.dispute.created', {
      id: 'dp_1',
      payment_intent: 'pi_1',
      amount: 4000,
      status: 'needs_response',
      reason: 'fraudulent',
      evidence_details: { due_by: 1711000000 },
      created: 1710000000,
    })

    const result = await normalizeAndPersist(event, 'wh_6', 'org_1')

    expect(result.kind).toBe('dispute')
    if (result.kind === 'dispute') {
      expect(result.data.disputeId).toBe('dp_1')
      expect(result.data.amountCents).toBe(BigInt(4000))
      expect(result.data.reason).toBe('fraudulent')
      expect(result.data.dueBy).toBeInstanceOf(Date)
    }
  })

  it('normalizes payout.paid', async () => {
    const event = fakeEvent('payout.paid', {
      id: 'po_1',
      amount: 15000,
      currency: 'cad',
      arrival_date: 1710000000,
      created: 1710000000,
    })

    const result = await normalizeAndPersist(event, 'wh_7', 'org_1')

    expect(result.kind).toBe('payout')
    if (result.kind === 'payout') {
      expect(result.data.payoutId).toBe('po_1')
      expect(result.data.amountCents).toBe(BigInt(15000))
      expect(result.data.currency).toBe('CAD')
      expect(result.data.status).toBe('paid')
      expect(result.data.arrivalDate).toBeDefined()
    }
  })

  it('normalizes invoice.paid', async () => {
    const event = fakeEvent('invoice.paid', {
      id: 'inv_1',
      amount_paid: 9900,
      currency: 'cad',
      metadata: { venture_id: 'v2' },
    })

    const result = await normalizeAndPersist(event, 'wh_8', 'org_1')

    expect(result.kind).toBe('payment')
    if (result.kind === 'payment') {
      expect(result.data.stripeObjectId).toBe('inv_1')
      expect(result.data.objectType).toBe('invoice')
      expect(result.data.status).toBe('paid')
      expect(result.data.amountCents).toBe(BigInt(9900))
      expect(result.data.ventureId).toBe('v2')
    }
  })

  it('defaults to null ventureId when metadata lacks it', async () => {
    const event = fakeEvent('checkout.session.completed', {
      id: 'cs_2',
      amount_total: 1000,
      currency: 'cad',
      metadata: {},
    })

    const result = await normalizeAndPersist(event, 'wh_9', 'org_1')

    if (result.kind === 'payment') {
      expect(result.data.ventureId).toBeNull()
    }
  })

  it('defaults currency to CAD when missing', async () => {
    const event = fakeEvent('checkout.session.completed', {
      id: 'cs_3',
      amount_total: 1000,
    })

    const result = await normalizeAndPersist(event, 'wh_10', 'org_1')

    if (result.kind === 'payment') {
      expect(result.data.currency).toBe('CAD')
    }
  })

  it('handles dispute without evidence_details.due_by', async () => {
    const event = fakeEvent('charge.dispute.created', {
      id: 'dp_2',
      payment_intent: 'pi_2',
      amount: 1000,
      status: 'needs_response',
      reason: null,
      created: 1710000000,
    })

    const result = await normalizeAndPersist(event, 'wh_11', 'org_1')

    if (result.kind === 'dispute') {
      expect(result.data.dueBy).toBeNull()
      expect(result.data.reason).toBeNull()
    }
  })

  it('handles payout without arrival_date', async () => {
    const event = fakeEvent('payout.paid', {
      id: 'po_2',
      amount: 5000,
      currency: 'usd',
      created: 1710000000,
    })

    const result = await normalizeAndPersist(event, 'wh_12', 'org_1')

    if (result.kind === 'payout') {
      expect(result.data.arrivalDate).toBeNull()
    }
  })

  it('skips unhandled but supported-looking event types', async () => {
    const event = fakeEvent('customer.subscription.updated', { id: 'sub_1' })
    const result = await normalizeAndPersist(event, 'wh_13', 'org_1')
    expect(result.kind).toBe('skipped')
    if (result.kind === 'skipped') {
      expect(result.reason).toContain('Unhandled event type')
    }
  })

  it('marks webhook event as processed after normalization', async () => {
    const event = fakeEvent('payout.paid', {
      id: 'po_3',
      amount: 1000,
      currency: 'cad',
      created: 1710000000,
    })

    await normalizeAndPersist(event, 'wh_14', 'org_1')

    expect(mocks.mockUpdate).toHaveBeenCalled()
    expect(mocks.mockSet).toHaveBeenCalledWith({ processingStatus: 'processed' })
  })

  it('falls back to charge id when payment_intent is missing on refund', async () => {
    const event = fakeEvent('charge.refunded', {
      id: 'ch_fallback',
      refunds: {
        data: [{ id: 're_3', amount: 500, status: 'succeeded', created: 1710000000 }],
      },
    })

    const result = await normalizeAndPersist(event, 'wh_15', 'org_1')

    if (result.kind === 'refund') {
      expect(result.data.paymentStripeObjectId).toBe('ch_fallback')
    }
  })
})
