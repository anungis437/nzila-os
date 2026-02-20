import { describe, it, expect, vi, beforeEach } from 'vitest'

// Shared mock instance so tests can configure it reliably
const mockCustomersCreate = vi.fn()
const mockSessionsCreate = vi.fn()
const mockRefundsCreate = vi.fn()
const mockStripeInstance = {
  customers: { create: mockCustomersCreate },
  checkout: { sessions: { create: mockSessionsCreate } },
  refunds: { create: mockRefundsCreate },
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
      entityId: 'entity_123',
    })

    expect(mockCustomersCreate).toHaveBeenCalledWith({
      email: 'test@example.com',
      name: 'Test User',
      metadata: { entity_id: 'entity_123' },
    })
    expect(result.id).toBe('cus_test')
  })

  it('includes venture_id in metadata when provided', async () => {
    mockCustomersCreate.mockResolvedValue({ id: 'cus_test2' })

    await createCustomer({
      email: 'a@b.com',
      name: 'Name',
      entityId: 'e1',
      ventureId: 'v1',
    })

    expect(mockCustomersCreate).toHaveBeenCalledWith({
      email: 'a@b.com',
      name: 'Name',
      metadata: { entity_id: 'e1', venture_id: 'v1' },
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
      entityId: 'ent1',
      lineItems: [{ name: 'Product', amountCents: 1000, quantity: 2 }],
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    })

    expect(mockSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
        metadata: { entity_id: 'ent1' },
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
      entityId: 'ent1',
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
