import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Env tests ───────────────────────────────────────────────────────────────

describe('stripeEnvSchema / getStripeEnv', () => {
  const VALID_ENV = {
    STRIPE_SECRET_KEY: 'sk_test_abc123',
    STRIPE_WEBHOOK_SECRET: 'whsec_abc123',
    STRIPE_ENVIRONMENT: 'test',
    STRIPE_DEFAULT_CURRENCY: 'CAD',
    STRIPE_REFUND_APPROVAL_THRESHOLD_CENTS: '50000',
  }

  beforeEach(() => {
    vi.resetModules()
    // Clear env
    for (const key of Object.keys(VALID_ENV)) {
      delete process.env[key]
    }
  })

  afterEach(() => {
    for (const key of Object.keys(VALID_ENV)) {
      delete process.env[key]
    }
  })

  it('parses valid env correctly', async () => {
    Object.assign(process.env, VALID_ENV)
    const { getStripeEnv } = await import('../env')
    const env = getStripeEnv()
    expect(env.STRIPE_SECRET_KEY).toBe('sk_test_abc123')
    expect(env.STRIPE_WEBHOOK_SECRET).toBe('whsec_abc123')
    expect(env.STRIPE_ENVIRONMENT).toBe('test')
    expect(env.STRIPE_DEFAULT_CURRENCY).toBe('CAD')
    expect(env.STRIPE_REFUND_APPROVAL_THRESHOLD_CENTS).toBe(50000)
  })

  it('throws if STRIPE_SECRET_KEY is missing', async () => {
    const partial = { ...VALID_ENV }
    delete (partial as Record<string, string | undefined>).STRIPE_SECRET_KEY
    Object.assign(process.env, partial)
    const { getStripeEnv } = await import('../env')
    expect(() => getStripeEnv()).toThrow('Stripe env validation failed')
  })

  it('throws if STRIPE_SECRET_KEY does not start with sk_', async () => {
    Object.assign(process.env, { ...VALID_ENV, STRIPE_SECRET_KEY: 'pk_test_wrong' })
    const { getStripeEnv } = await import('../env')
    expect(() => getStripeEnv()).toThrow('must start with sk_')
  })

  it('throws if STRIPE_WEBHOOK_SECRET does not start with whsec_', async () => {
    Object.assign(process.env, { ...VALID_ENV, STRIPE_WEBHOOK_SECRET: 'bad_secret' })
    const { getStripeEnv } = await import('../env')
    expect(() => getStripeEnv()).toThrow('must start with whsec_')
  })

  it('uses defaults for optional fields', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_secret'
    const { getStripeEnv } = await import('../env')
    const env = getStripeEnv()
    expect(env.STRIPE_ENVIRONMENT).toBe('test')
    expect(env.STRIPE_DEFAULT_CURRENCY).toBe('CAD')
    expect(env.STRIPE_REFUND_APPROVAL_THRESHOLD_CENTS).toBe(50000)
  })

  it('coerces threshold from string to number', async () => {
    Object.assign(process.env, { ...VALID_ENV, STRIPE_REFUND_APPROVAL_THRESHOLD_CENTS: '123456' })
    const { getStripeEnv } = await import('../env')
    const env = getStripeEnv()
    expect(env.STRIPE_REFUND_APPROVAL_THRESHOLD_CENTS).toBe(123456)
    expect(typeof env.STRIPE_REFUND_APPROVAL_THRESHOLD_CENTS).toBe('number')
  })

  it('rejects invalid STRIPE_ENVIRONMENT value', async () => {
    Object.assign(process.env, { ...VALID_ENV, STRIPE_ENVIRONMENT: 'staging' })
    const { getStripeEnv } = await import('../env')
    expect(() => getStripeEnv()).toThrow('Stripe env validation failed')
  })

  it('rejects STRIPE_DEFAULT_CURRENCY with wrong length', async () => {
    Object.assign(process.env, { ...VALID_ENV, STRIPE_DEFAULT_CURRENCY: 'US' })
    const { getStripeEnv } = await import('../env')
    expect(() => getStripeEnv()).toThrow('Stripe env validation failed')
  })

  it('validateStripeEnv calls getStripeEnv eagerly', async () => {
    Object.assign(process.env, VALID_ENV)
    const { validateStripeEnv } = await import('../env')
    expect(() => validateStripeEnv()).not.toThrow()
  })

  it('returns cached env on second call', async () => {
    Object.assign(process.env, VALID_ENV)
    const { getStripeEnv } = await import('../env')
    const first = getStripeEnv()
    const second = getStripeEnv()
    expect(first).toBe(second)
  })
})
