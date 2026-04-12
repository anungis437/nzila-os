import { describe, it, expect, vi, beforeEach } from 'vitest'

// Shared mock instance so tests can configure it reliably
const mockCustomersCreate = vi.fn()
const mockSessionsCreate = vi.fn()
const mockRefundsCreate = vi.fn()
const mockSubscriptionsCreate = vi.fn()
const mockPortalSessionsCreate = vi.fn()
const mockCustomerSessionsCreate = vi.fn()

const mockStripeInstance = {
  customers: { create: mockCustomersCreate },
  checkout: { sessions: { create: mockSessionsCreate } },
  refunds: { create: mockRefundsCreate },
  subscriptions: { create: mockSubscriptionsCreate },
  billingPortal: { sessions: { create: mockPortalSessionsCreate } },
  customerSessions: { create: mockCustomerSessionsCreate },
}

vi.mock('../client', () => ({
  getStripeClient: vi.fn(() => mockStripeInstance),
}))

vi.mock('../env', () => ({
  getStripeEnv: vi.fn(() => ({
    STRIPE_SECRET_KEY: 'sk_test_abc',
    STRIPE_WEBHOOK_SECRET: 'whsec_secret',
    STRIPE_ENVIRONMENT: 'test',
    STRIPE_DEFAULT_CURRENCY: 'CAD',
    STRIPE_REFUND_APPROVAL_THRESHOLD_CENTS: 50000,
  })),
}))

import {
  createCustomer,
  createCheckoutSession,
  executeRefund,
  requiresApproval,
  createSubscription,
  createSubscriptionCheckoutSession,
  createPortalSession,
  createCustomerSession,
} from '../primitives'

describe('requiresApproval', () => {
  it('returns true when amount >= threshold', () => {
    expect(requiresApproval(50000)).toBe(true)
    expect(requiresApproval(75000)).toBe(true)
  })

  it('returns false when amount < threshold', () => {
    expect(requiresApproval(49999)).toBe(false)
    expect(requiresApproval(0)).toBe(false)
  })
})

describe('createCustomer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls stripe.customers.create with correct params', async () => {
    mockCustomersCreate.mockResolvedValue({ id: 'cus_test' })

    const result = await createCustomer({
      email: 'test@example.com',
      name: 'Test User',
      orgId: 'entity_123',
    })

    expect(mockCustomersCreate).toHaveBeenCalledWith({
      email: 'test@example.com',
      name: 'Test User',
      metadata: { org_id: 'entity_123' },
    })
    expect(result.id).toBe('cus_test')
  })

  it('includes venture_id in metadata when provided', async () => {
    mockCustomersCreate.mockResolvedValue({ id: 'cus_test2' })

    await createCustomer({
      email: 'a@b.com',
      name: 'Name',
      orgId: 'e1',
      ventureId: 'v1',
    })

    expect(mockCustomersCreate).toHaveBeenCalledWith({
      email: 'a@b.com',
      name: 'Name',
      metadata: { org_id: 'e1', venture_id: 'v1' },
    })
  })
})

describe('createCheckoutSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates session with price_data for ad-hoc items', async () => {
    mockSessionsCreate.mockResolvedValue({
      id: 'cs_test',
      url: 'https://checkout.stripe.com/session',
    })

    const result = await createCheckoutSession({
      orgId: 'ent1',
      lineItems: [{ name: 'Product', amountCents: 1000, quantity: 2 }],
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    })

    expect(mockSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
        metadata: { org_id: 'ent1' },
        line_items: [
          {
            price_data: {
              currency: 'cad',
              product_data: { name: 'Product' },
              unit_amount: 1000,
            },
            quantity: 2,
          },
        ],
      }),
    )
    expect(result.url).toBe('https://checkout.stripe.com/session')
  })

  it('uses priceId when provided', async () => {
    mockSessionsCreate.mockResolvedValue({ id: 'cs_x' })

    await createCheckoutSession({
      orgId: 'ent1',
      lineItems: [{ priceId: 'price_abc', amountCents: 0, quantity: 1 }],
      successUrl: 'https://x.com/ok',
      cancelUrl: 'https://x.com/no',
    })

    const call = mockSessionsCreate.mock.calls[0][0]
    expect(call.line_items[0]).toEqual({ price: 'price_abc', quantity: 1 })
  })
})

describe('executeRefund', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls stripe.refunds.create with payment_intent', async () => {
    mockRefundsCreate.mockResolvedValue({ id: 're_test' })

    const result = await executeRefund({ paymentIntentId: 'pi_abc' })

    expect(mockRefundsCreate).toHaveBeenCalledWith({
      payment_intent: 'pi_abc',
    })
    expect(result.id).toBe('re_test')
  })

  it('includes optional amount and reason', async () => {
    mockRefundsCreate.mockResolvedValue({ id: 're_test2' })

    await executeRefund({
      paymentIntentId: 'pi_xyz',
      amountCents: 500,
      reason: 'requested_by_customer',
    })

    expect(mockRefundsCreate).toHaveBeenCalledWith({
      payment_intent: 'pi_xyz',
      amount: 500,
      reason: 'requested_by_customer',
    })
  })
})

// ── createSubscription ──────────────────────────────────────────────────────

describe('createSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates subscription with correct params and returns result', async () => {
    mockSubscriptionsCreate.mockResolvedValue({
      id: 'sub_1',
      status: 'incomplete',
      latest_invoice: {
        payment_intent: { client_secret: 'pi_secret_1' },
      },
      items: {
        data: [{ current_period_end: 1720000000 }],
      },
    })

    const result = await createSubscription({
      customerId: 'cus_1',
      priceId: 'price_1',
      orgId: 'org_1',
    })

    expect(result.subscriptionId).toBe('sub_1')
    expect(result.clientSecret).toBe('pi_secret_1')
    expect(result.status).toBe('incomplete')
    expect(result.currentPeriodEnd).toBe(1720000000)

    expect(mockSubscriptionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_1',
        items: [{ price: 'price_1' }],
        payment_behavior: 'default_incomplete',
        metadata: { org_id: 'org_1' },
      }),
    )
  })

  it('includes trial_period_days when trialDays provided', async () => {
    mockSubscriptionsCreate.mockResolvedValue({
      id: 'sub_2',
      status: 'trialing',
      latest_invoice: { payment_intent: null },
      items: { data: [{ current_period_end: 1720000000 }] },
    })

    const result = await createSubscription({
      customerId: 'cus_1',
      priceId: 'price_1',
      orgId: 'org_1',
      trialDays: 14,
    })

    expect(result.clientSecret).toBeNull()
    expect(mockSubscriptionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ trial_period_days: 14 }),
    )
  })

  it('includes venture_id in metadata when provided', async () => {
    mockSubscriptionsCreate.mockResolvedValue({
      id: 'sub_3',
      status: 'incomplete',
      latest_invoice: { payment_intent: { client_secret: 'cs' } },
      items: { data: [{ current_period_end: 1720000000 }] },
    })

    await createSubscription({
      customerId: 'cus_1',
      priceId: 'price_1',
      orgId: 'org_1',
      ventureId: 'v_1',
    })

    expect(mockSubscriptionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ venture_id: 'v_1' }),
      }),
    )
  })
})

// ── createPortalSession ─────────────────────────────────────────────────────

describe('createPortalSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates portal session with customer and return URL', async () => {
    mockPortalSessionsCreate.mockResolvedValue({
      id: 'bps_1',
      url: 'https://billing.stripe.com/session/bps_1',
    })

    const result = await createPortalSession({
      customerId: 'cus_test',
      returnUrl: 'https://app.example.com/billing',
    })

    expect(result.id).toBe('bps_1')
    expect(mockPortalSessionsCreate).toHaveBeenCalledWith({
      customer: 'cus_test',
      return_url: 'https://app.example.com/billing',
    })
  })
})

// ── createSubscriptionCheckoutSession ───────────────────────────────────────

describe('createSubscriptionCheckoutSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates subscription checkout session', async () => {
    mockSessionsCreate.mockResolvedValue({
      id: 'cs_sub_1',
      url: 'https://checkout.stripe.com/pay/cs_sub_1',
    })

    const result = await createSubscriptionCheckoutSession({
      priceId: 'price_month',
      orgId: 'org_1',
      successUrl: 'https://app.com/success',
      cancelUrl: 'https://app.com/cancel',
    })

    expect(result.sessionId).toBe('cs_sub_1')
    expect(result.url).toBe('https://checkout.stripe.com/pay/cs_sub_1')
    expect(mockSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        line_items: [{ price: 'price_month', quantity: 1 }],
        success_url: 'https://app.com/success',
        cancel_url: 'https://app.com/cancel',
        metadata: { org_id: 'org_1' },
      }),
    )
  })

  it('includes customerId when provided', async () => {
    mockSessionsCreate.mockResolvedValue({ id: 'cs_sub_2', url: 'https://checkout.stripe.com/x' })

    await createSubscriptionCheckoutSession({
      priceId: 'price_1',
      orgId: 'org_1',
      customerId: 'cus_existing',
      successUrl: 'https://x.com/ok',
      cancelUrl: 'https://x.com/no',
    })

    expect(mockSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_existing' }),
    )
  })

  it('includes trial_period_days when trialDays provided', async () => {
    mockSessionsCreate.mockResolvedValue({ id: 'cs_sub_3', url: 'https://x.com' })

    await createSubscriptionCheckoutSession({
      priceId: 'price_1',
      orgId: 'org_1',
      successUrl: 'https://x.com/ok',
      cancelUrl: 'https://x.com/no',
      trialDays: 7,
    })

    expect(mockSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_data: expect.objectContaining({ trial_period_days: 7 }),
      }),
    )
  })
})

// ── createCustomerSession ───────────────────────────────────────────────────

describe('createCustomerSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates customer session with embedded payment element config', async () => {
    mockCustomerSessionsCreate.mockResolvedValue({ client_secret: 'cs_secret_1' })

    const result = await createCustomerSession({ customerId: 'cus_embed' })

    expect(result.client_secret).toBe('cs_secret_1')
    expect(mockCustomerSessionsCreate).toHaveBeenCalledWith({
      customer: 'cus_embed',
      components: {
        payment_element: {
          enabled: true,
          features: {
            payment_method_redisplay: 'enabled',
            payment_method_save: 'enabled',
            payment_method_save_usage: 'off_session',
            payment_method_remove: 'enabled',
          },
        },
      },
    })
  })
})
