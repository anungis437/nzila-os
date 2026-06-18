import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockInsert,
  mockSelect,
  mockUpdate,
  mockAnd,
  mockEq,
  mockMapFlowPlanFromPriceId,
  mockMapStripeSubscriptionStatus,
} = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
  mockAnd: vi.fn((...x: unknown[]) => x),
  mockEq: vi.fn((a: unknown, b: unknown) => [a, b]),
  mockMapFlowPlanFromPriceId: vi.fn(() => 'pro'),
  mockMapStripeSubscriptionStatus: vi.fn(() => 'active'),
}))

vi.mock('drizzle-orm', () => ({
  and: mockAnd,
  eq: mockEq,
}))

vi.mock('@nzila/db', () => ({
  db: {
    insert: mockInsert,
    select: mockSelect,
    update: mockUpdate,
  },
}))

vi.mock('@nzila/db/schema', () => ({
  stripeSubscriptions: {
    id: 'id',
    orgId: 'orgId',
    stripeSubscriptionId: 'stripeSubscriptionId',
  },
  stripeWebhookEvents: {
    id: 'id',
  },
}))

vi.mock('@/lib/billing-webhook', () => ({
  mapFlowPlanFromPriceId: mockMapFlowPlanFromPriceId,
  mapStripeSubscriptionStatus: mockMapStripeSubscriptionStatus,
}))

function makeWebhookInsertReturning(rows: unknown[]) {
  return {
    values: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(rows),
  }
}

describe('stripe-webhook-persistence slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns ignored for non-billing webhook events', async () => {
    mockInsert.mockReturnValueOnce(makeWebhookInsertReturning([{ id: 'evt-row-1' }]))

    const { persistStripeWebhookEvent } = await import('@/lib/stripe-webhook-persistence')
    const result = await persistStripeWebhookEvent(
      {
        id: 'evt_1',
        type: 'customer.created',
        livemode: false,
        created: 1,
        data: { object: {} },
      },
      'org-1',
    )

    expect(result).toEqual({ ok: true, received: true, ignored: true })
  })

  it('updates existing subscription for subscription_updated events', async () => {
    const webhookInsert = makeWebhookInsertReturning([{ id: 'evt-row-2' }])
    const subscriptionLookup = {
      from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([{ id: 'sub-row-1' }]) })) })),
    }
    const updateSubChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(undefined) }
    const updateWebhookChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(undefined) }

    mockInsert.mockReturnValueOnce(webhookInsert)
    mockSelect.mockReturnValueOnce(subscriptionLookup)
    mockUpdate.mockReturnValueOnce(updateSubChain).mockReturnValueOnce(updateWebhookChain)

    const { persistStripeWebhookEvent } = await import('@/lib/stripe-webhook-persistence')
    const result = await persistStripeWebhookEvent(
      {
        id: 'evt_2',
        type: 'customer.subscription.updated',
        livemode: false,
        created: 2,
        data: {
          object: {
            id: 'sub_1',
            customer: 'cus_1',
            status: 'active',
            items: {
              data: [
                {
                  current_period_end: 1735689600,
                  plan: { interval: 'month', amount: 3000 },
                  price: { id: 'price_1', product: 'prod_1' },
                },
              ],
            },
          },
        },
      },
      'org-1',
    )

    expect(result).toEqual({ ok: true, received: true })
    expect(mockUpdate).toHaveBeenCalledTimes(2)
  })

  it('inserts new subscription for canceled events when no existing row', async () => {
    const webhookInsert = makeWebhookInsertReturning([{ id: 'evt-row-3' }])
    const subscriptionLookup = {
      from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })) })),
    }
    const insertSubscription = { values: vi.fn().mockResolvedValue(undefined) }
    const updateWebhookChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(undefined) }

    mockInsert
      .mockReturnValueOnce(webhookInsert)
      .mockReturnValueOnce(insertSubscription)
    mockSelect.mockReturnValueOnce(subscriptionLookup)
    mockUpdate.mockReturnValueOnce(updateWebhookChain)

    const { persistStripeWebhookEvent } = await import('@/lib/stripe-webhook-persistence')
    const result = await persistStripeWebhookEvent(
      {
        id: 'evt_3',
        type: 'customer.subscription.deleted',
        livemode: false,
        created: 3,
        data: {
          object: {
            id: 'sub_2',
            customer: { id: 'cus_2' },
            status: 'canceled',
            items: {
              data: [
                {
                  current_period_start: 1735603200,
                  current_period_end: 1735689600,
                  plan: { interval: 'month', amount: 5000 },
                  price: { id: 'price_2', product: { toString: () => 'prod_2' } },
                },
              ],
            },
          },
        },
      },
      'org-2',
    )

    expect(result).toEqual({ ok: true, received: true })
    expect(mockInsert).toHaveBeenCalledTimes(2)
  })

  it('handles checkout completed with string subscription id and no persisted id', async () => {
    const webhookInsert = makeWebhookInsertReturning([])
    const subscriptionLookup = {
      from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })) })),
    }
    const insertSubscription = { values: vi.fn().mockResolvedValue(undefined) }

    mockInsert.mockReturnValueOnce(webhookInsert).mockReturnValueOnce(insertSubscription)
    mockSelect.mockReturnValueOnce(subscriptionLookup)

    const { persistStripeWebhookEvent } = await import('@/lib/stripe-webhook-persistence')
    const result = await persistStripeWebhookEvent(
      {
        id: 'evt_4',
        type: 'checkout.session.completed',
        livemode: false,
        created: 4,
        data: { object: { subscription: 'sub_4', customer: 'cus_4' } },
      },
      'org-4',
    )

    expect(result).toEqual({ ok: true, received: true })
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
