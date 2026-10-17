import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  initiateDuesPayment: vi.fn(),
  auth: vi.fn(),
  createCheckoutSession: vi.fn(),
}))

// withApi is exercised elsewhere; here it is a pass-through so the handler's own gate is what runs.
vi.mock('@/lib/api/framework', async () => {
  const { ApiError } = await import('@/lib/api/errors')
  return {
    ApiError,
    RATE_LIMITS: { FINANCIAL_WRITE: {} },
    withApi: (_options: unknown, handler: (ctx: unknown) => unknown) => handler,
  }
})
vi.mock('@/lib/stripe', () => ({ stripe: {} }))
vi.mock('@/lib/dues/dues-payment-service', () => ({
  DuesInitiationError: class extends Error {},
  initiateDuesPayment: m.initiateDuesPayment,
}))
vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }))
vi.mock('@/lib/services/payment-service', () => ({
  PaymentService: { createCheckoutSession: m.createCheckoutSession },
}))
vi.mock('@/db/db', () => ({ db: {} }))
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: vi.fn() }))
vi.mock('@/lib/api-auth-guard', () => ({ requireUserForOrganization: vi.fn() }))
vi.mock('@/db/schema/dues-finance-schema', () => ({ memberDuesLedger: {} }))

const context = { organizationId: 'org_1', userId: 'user_1' }
const flag = 'UE_MEMBER_DUES_PAYMENTS'

describe('member dues payment is a dormant optional capability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env[flag]
    m.auth.mockResolvedValue({ userId: 'user_1' })
    m.initiateDuesPayment.mockResolvedValue({
      clientSecret: 'cs',
      paymentIntentId: 'pi_1',
      paymentId: 'p_1',
      amount: 40,
      currency: 'cad',
    })
  })

  describe('flag helper', () => {
    it('is off unless explicitly set to 1, whatever Stripe configuration exists', async () => {
      const { isMemberDuesPaymentEnabled } = await import('../member-dues-flag')
      expect(isMemberDuesPaymentEnabled({})).toBe(false)
      expect(isMemberDuesPaymentEnabled({ STRIPE_SECRET_KEY: 'sk_test_x' })).toBe(false)
      expect(isMemberDuesPaymentEnabled({ UE_MEMBER_DUES_PAYMENTS: 'true' })).toBe(false)
      expect(isMemberDuesPaymentEnabled({ UE_MEMBER_DUES_PAYMENTS: '1' })).toBe(true)
    })
  })

  describe('POST /api/dues/create-payment-intent', () => {
    it('answers 501 and never reaches the payment service when the capability is off', async () => {
      const { POST } = await import('../../../app/api/dues/create-payment-intent/route')
      await expect(
        (POST as unknown as (c: unknown) => Promise<unknown>)(context),
      ).rejects.toMatchObject({
        code: 'NOT_IMPLEMENTED',
      })
      expect(m.initiateDuesPayment).not.toHaveBeenCalled()
    })

    it('initiates a server-owned payment when explicitly enabled', async () => {
      process.env[flag] = '1'
      const { POST } = await import('../../../app/api/dues/create-payment-intent/route')
      const result = await (
        POST as unknown as (c: unknown) => Promise<{ paymentIntentId: string }>
      )(context)
      expect(result.paymentIntentId).toBe('pi_1')
      expect(m.initiateDuesPayment).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org_1', userId: 'user_1' }),
      )
    })
  })

  describe('POST /api/portal/dues/pay', () => {
    it('answers 501 and never reaches the payment service when the capability is off', async () => {
      const { POST } = await import('../../../app/api/portal/dues/pay/route')
      await expect(
        (POST as unknown as (c: unknown) => Promise<unknown>)(context),
      ).rejects.toMatchObject({
        code: 'NOT_IMPLEMENTED',
      })
      expect(m.initiateDuesPayment).not.toHaveBeenCalled()
    })

    it('initiates a server-owned payment when explicitly enabled', async () => {
      process.env[flag] = '1'
      const { POST } = await import('../../../app/api/portal/dues/pay/route')
      await (POST as unknown as (c: unknown) => Promise<unknown>)(context)
      expect(m.initiateDuesPayment).toHaveBeenCalledTimes(1)
    })
  })

  describe('POST /api/payments/checkout/create (legacy)', () => {
    const request = () =>
      ({
        json: async () => ({
          transactionId: '3f1c2a4e-5b6d-4e7f-8a9b-0c1d2e3f4a5b',
          returnUrl: 'https://example.invalid/ok',
          cancelUrl: 'https://example.invalid/no',
        }),
      }) as never

    it('requires authentication before anything else', async () => {
      m.auth.mockResolvedValue({ userId: null })
      const { POST } = await import('../../../app/api/payments/checkout/create/route')
      expect((await POST(request())).status).toBe(401)
    })

    it('answers 501 without touching the payment service when the capability is off', async () => {
      const { POST } = await import('../../../app/api/payments/checkout/create/route')
      const response = await POST(request())
      expect(response.status).toBe(501)
      expect(await response.json()).toMatchObject({ code: 'NOT_IMPLEMENTED' })
      expect(m.createCheckoutSession).not.toHaveBeenCalled()
    })
  })
})
