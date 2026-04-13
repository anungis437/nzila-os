import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => {
  const mockStripeConstructor = vi.fn().mockImplementation(() => ({
    customers: {},
    checkout: {},
  }))
  return { mockStripeConstructor }
})

vi.mock('../env', () => ({
  getStripeEnv: vi.fn(() => ({
    STRIPE_SECRET_KEY: 'sk_test_fake123',
    STRIPE_WEBHOOK_SECRET: 'whsec_secret',
    STRIPE_ENVIRONMENT: 'test',
    STRIPE_DEFAULT_CURRENCY: 'CAD',
    STRIPE_REFUND_APPROVAL_THRESHOLD_CENTS: 50000,
  })),
}))

vi.mock('stripe', () => ({
  default: class MockStripe {
    constructor(...args: unknown[]) {
      mocks.mockStripeConstructor(...args)
      Object.assign(this, { customers: {}, checkout: {} })
    }
  },
}))

describe('getStripeClient', () => {
  beforeEach(async () => {
    vi.resetModules()
    mocks.mockStripeConstructor.mockClear()
    vi.doMock('stripe', () => ({
      default: class MockStripe {
        constructor(...args: unknown[]) {
          mocks.mockStripeConstructor(...args)
          Object.assign(this, { customers: {}, checkout: {} })
        }
      },
    }))
    vi.doMock('../env', () => ({
      getStripeEnv: vi.fn(() => ({
        STRIPE_SECRET_KEY: 'sk_test_client123',
        STRIPE_WEBHOOK_SECRET: 'whsec_secret',
        STRIPE_ENVIRONMENT: 'test',
        STRIPE_DEFAULT_CURRENCY: 'CAD',
        STRIPE_REFUND_APPROVAL_THRESHOLD_CENTS: 50000,
      })),
    }))
  })

  it('creates a Stripe instance with correct config', async () => {
    const { getStripeClient } = await import('../client')
    const client = getStripeClient()
    expect(client).toBeDefined()
    expect(mocks.mockStripeConstructor).toHaveBeenCalledWith('sk_test_client123', {
      apiVersion: '2026-02-25.clover',
      typescript: true,
      maxNetworkRetries: 3,
    })
  })

  it('returns the same singleton on subsequent calls', async () => {
    const { getStripeClient } = await import('../client')
    const client1 = getStripeClient()
    const client2 = getStripeClient()
    expect(client1).toBe(client2)
    expect(mocks.mockStripeConstructor).toHaveBeenCalledTimes(1)
  })
})
