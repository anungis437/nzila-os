import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  initiateDuesPayment: vi.fn(),
  auth: vi.fn(),
  createCheckoutSession: vi.fn(),
}))

// withApi is exercised elsewhere; here it is a pass-through so the handler's own gate is what runs. The options a route declared stay on the handler.
vi.mock('@/lib/api/framework', async () => {
  const { ApiError } = await import('@/lib/api/errors')
  return {
    ApiError,
    RATE_LIMITS: { FINANCIAL_WRITE: {} },
    withApi: (options: unknown, handler: (ctx: unknown) => unknown) => Object.assign((ctx: unknown) => handler(ctx), { options }),
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
  afterEach(() => {
    delete process.env[flag]
  })

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
    it('is off whatever Stripe configuration exists', async () => {
      const { isMemberDuesPaymentEnabled } = await import('../member-dues-flag')
      expect(isMemberDuesPaymentEnabled({})).toBe(false)
      expect(isMemberDuesPaymentEnabled({ STRIPE_SECRET_KEY: 'sk_test_x' })).toBe(false)
      expect(isMemberDuesPaymentEnabled({ UE_MEMBER_DUES_PAYMENTS: 'true' })).toBe(false)
    })

    // DEF-0B11-PRP-DUES-PAY-POST-SENDS-THE-ORGANIZATION-AND-MEMBER-USER-ID-TO-THE-PROCESSOR: no source names the merchant account
    // or records the member's consent to disclose the organization and member ids to the processor, and the owner decision is that
    // Union Eyes does not collect dues. The deployment flag alone can no longer switch collection on.
    it('stays off even when UE_MEMBER_DUES_PAYMENTS=1, and says why', async () => {
      const { isMemberDuesPaymentEnabled, assertMemberDuesPaymentEnabled } = await import('../member-dues-flag')
      expect(isMemberDuesPaymentEnabled({ UE_MEMBER_DUES_PAYMENTS: '1', STRIPE_SECRET_KEY: 'sk_test_x' })).toBe(false)
      expect(() => assertMemberDuesPaymentEnabled({ UE_MEMBER_DUES_PAYMENTS: '1' })).toThrow(/merchant account/)
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

    it('still answers 501 and sends nothing to the processor when the deployment flag is set', async () => {
      process.env[flag] = '1'
      const { POST } = await import('../../../app/api/dues/create-payment-intent/route')
      await expect((POST as unknown as (c: unknown) => Promise<unknown>)(context)).rejects.toMatchObject({
        code: 'NOT_IMPLEMENTED',
      })
      expect(m.initiateDuesPayment).not.toHaveBeenCalled()
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

    it('still answers 501 and sends neither the organization nor the member id to the processor when the deployment flag is set', async () => {
      process.env[flag] = '1'
      const { POST } = await import('../../../app/api/portal/dues/pay/route')
      await expect((POST as unknown as (c: unknown) => Promise<unknown>)(context)).rejects.toMatchObject({
        code: 'NOT_IMPLEMENTED',
      })
      expect(m.initiateDuesPayment).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/payments/checkout/create (legacy)', () => {
    const body = {
      transactionId: '3f1c2a4e-5b6d-4e7f-8a9b-0c1d2e3f4a5b',
      returnUrl: 'https://example.invalid/ok',
      cancelUrl: 'https://example.invalid/no',
      processorType: 'stripe',
    }

    it('requires authentication before anything else: the framework refuses an unauthenticated call before the handler runs', async () => {
      const { POST } = await import('../../../app/api/payments/checkout/create/route')
      expect((POST as unknown as { options: { auth: { required: boolean } } }).options.auth).toEqual({ required: true })
    })

    it('answers 501 without touching the payment service when the capability is off', async () => {
      const { POST } = await import('../../../app/api/payments/checkout/create/route')
      const response = await (POST as unknown as (c: unknown) => Promise<Response>)({ ...context, body })
      expect(response.status).toBe(501)
      expect(await response.json()).toMatchObject({ code: 'NOT_IMPLEMENTED' })
      expect(m.createCheckoutSession).not.toHaveBeenCalled()
    })

    it('answers 501 without touching the payment service even when the deployment flag is set', async () => {
      process.env[flag] = '1'
      const { POST } = await import('../../../app/api/payments/checkout/create/route')
      const response = await (POST as unknown as (c: unknown) => Promise<Response>)({ ...context, body })
      expect(response.status).toBe(501)
      expect(m.createCheckoutSession).not.toHaveBeenCalled()
    })
  })
})
