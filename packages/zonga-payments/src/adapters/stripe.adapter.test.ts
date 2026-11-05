import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createStripeAdapter, type StripeConfig } from './stripe.adapter'
import { PaymentProvider, PaymentIntentStatus, PayoutStatus, RefundStatus } from '../types'

const mocks = vi.hoisted(() => ({
  factory: vi.fn(),
  intentCreate: vi.fn(), intentCapture: vi.fn(),
  chargeRetrieve: vi.fn(), refundCreate: vi.fn(), payoutCreate: vi.fn(),
  verify: vi.fn(),
}))

vi.mock('@nzila/payments-stripe', () => ({
  createStripeClientForKey: (...args: unknown[]) => {
    mocks.factory(...args)
    return {
      paymentIntents: { create: mocks.intentCreate, capture: mocks.intentCapture },
      charges: { retrieve: mocks.chargeRetrieve },
      refunds: { create: mocks.refundCreate },
      payouts: { create: mocks.payoutCreate },
      webhooks: { constructEvent: mocks.verify },
    }
  },
}))

const config: StripeConfig = { secretKey: 'sk_test_123', webhookSecret: 'whsec_test' }
const fakeIntent = (extra: Record<string, unknown> = {}) => ({
  id: 'pi_123', status: 'requires_confirmation', amount: 1000000,
  currency: 'usd', metadata: {}, created: 1700000000, client_secret: 'cs_test', ...extra,
})
const intentRequest = () => ({
  orderId: 'ord-1', userId: 'user-1', amount: 10000,
  currency: 'USD', method: 'card', provider: PaymentProvider.STRIPE, idempotencyKey: 'idem-1',
})

describe('Stripe adapter uses the shared Endive SDK', () => {
  beforeEach(() => vi.resetAllMocks())

  it('uses the one SDK factory and exposes STRIPE provider', () => {
    const adapter = createStripeAdapter(config)
    expect(mocks.factory).toHaveBeenCalledWith('sk_test_123')
    expect(adapter.provider).toBe(PaymentProvider.STRIPE)
  })

  it('creates an intent through the official SDK with dynamic methods and idempotency', async () => {
    mocks.intentCreate.mockResolvedValue(fakeIntent())
    const result = await createStripeAdapter(config).createIntent(intentRequest())
    expect(result.id).toBe('pi_123')
    expect(result.status).toBe(PaymentIntentStatus.CREATED)
    expect(result.metadata.clientSecret).toBe('cs_test')
    expect(mocks.intentCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 1000000, currency: 'usd', automatic_payment_methods: { enabled: true } }),
      expect.objectContaining({ idempotencyKey: 'idem-1' }),
    )
    expect(mocks.intentCreate.mock.calls[0][0]).not.toHaveProperty('payment_method_types')
  })

  it('maps processing status and propagates SDK errors', async () => {
    mocks.intentCreate.mockResolvedValueOnce(fakeIntent({ status: 'processing' }))
    const adapter = createStripeAdapter(config)
    expect((await adapter.createIntent(intentRequest())).status).toBe(PaymentIntentStatus.PROCESSING)
    mocks.intentCreate.mockRejectedValueOnce(new Error('Invalid amount'))
    await expect(adapter.createIntent(intentRequest())).rejects.toThrow('Invalid amount')
  })

  it('captures intent and reads its receipt from the charge', async () => {
    mocks.intentCapture.mockResolvedValue(fakeIntent({ id: 'pi_cap', amount: 1000, status: 'succeeded', latest_charge: 'ch_abc' }))
    mocks.chargeRetrieve.mockResolvedValue({ receipt_url: 'https://receipt.stripe.com/ch_abc' })
    const capture = await createStripeAdapter(config).captureIntent('pi_cap')
    expect(capture.capturedAmount).toBe(10)
    expect(capture.receiptUrl).toBe('https://receipt.stripe.com/ch_abc')
    expect(mocks.chargeRetrieve).toHaveBeenCalledWith('ch_abc', {})
  })

  it('allows capture without a charge and does not fabricate a receipt', async () => {
    mocks.intentCapture.mockResolvedValue(fakeIntent({ latest_charge: null, amount: 500 }))
    const capture = await createStripeAdapter(config).captureIntent('pi_nochg')
    expect(capture.receiptUrl).toBeNull()
    expect(mocks.chargeRetrieve).not.toHaveBeenCalled()
  })

  it('creates refunds without an unnecessary prior read', async () => {
    mocks.refundCreate.mockResolvedValue({ id: 're_123', amount: 500, status: 'succeeded', created: 1700000001 })
    const refund = await createStripeAdapter(config).refundIntent('pi_ref', 5, 'duplicate')
    expect(refund.status).toBe(RefundStatus.COMPLETED)
    expect(refund.amount).toBe(5)
    expect(mocks.refundCreate).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: 'pi_ref', amount: 500, reason: 'duplicate' }), {},
    )
  })

  it('maps pending refunds to processing', async () => {
    mocks.refundCreate.mockResolvedValue({ id: 're_pending', amount: 300, status: 'pending', created: 1700000001 })
    expect((await createStripeAdapter(config).refundIntent('pi_ref', 3, 'requested')).status).toBe(RefundStatus.PROCESSING)
  })

  it('creates a payout using the SDK', async () => {
    mocks.payoutCreate.mockResolvedValue({ id: 'po_1', status: 'paid', arrival_date: 1700086400 })
    const payout = await createStripeAdapter(config).createPayout({
      id: 'po-1', recipientId: 'artist-1', amount: 5000, currency: 'USD',
      method: 'card', provider: PaymentProvider.STRIPE,
      destination: { type: 'bank_account', accountIdentifier: 'ba_123', accountName: 'Artist' },
      status: PayoutStatus.PENDING, providerPayoutId: null, batchId: null,
      scheduledAt: new Date(), completedAt: null,
    })
    expect(payout.status).toBe(PayoutStatus.COMPLETED)
    expect(mocks.payoutCreate).toHaveBeenCalledWith(expect.objectContaining({ amount: 500000 }), {})
  })

  it('verifies signed webhook by delegating to the SDK, rejecting bad signatures', () => {
    const adapter = createStripeAdapter(config)
    mocks.verify.mockReturnValue({})
    expect(adapter.verifyWebhook('t=valid,v1=signed', '{}')).toBe(true)
    expect(mocks.verify).toHaveBeenCalledWith('{}', 't=valid,v1=signed', 'whsec_test')
    mocks.verify.mockImplementation(() => { throw new Error('bad signature') })
    expect(adapter.verifyWebhook('t=123,v1=abc123', '{}')).toBe(false)
    expect(createStripeAdapter({ ...config, webhookSecret: '' }).verifyWebhook('t=valid,v1=signed', '{}')).toBe(false)
  })

  it('isolates connected-account requests through Stripe-Account options', async () => {
    mocks.intentCreate.mockResolvedValue(fakeIntent())
    const adapter = createStripeAdapter({ ...config, connectAccountId: 'acct_123' })
    await adapter.createIntent(intentRequest())
    expect(mocks.intentCreate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      stripeAccount: 'acct_123', idempotencyKey: 'idem-1',
    }))
  })
})
