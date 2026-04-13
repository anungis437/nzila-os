import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createStripeAdapter, type StripeConfig } from './stripe.adapter'
import { PaymentProvider, PaymentIntentStatus, PayoutStatus, RefundStatus } from '../types'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const config: StripeConfig = {
  secretKey: 'sk_test_123',
  webhookSecret: 'whsec_test',
  apiVersion: '2024-04-10',
}

function jsonResponse(data: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, statusText: 'OK', json: () => Promise.resolve(data), text: () => Promise.resolve(JSON.stringify(data)) }
}

describe('createStripeAdapter', () => {
  let adapter: ReturnType<typeof createStripeAdapter>

  beforeEach(() => {
    vi.clearAllMocks()
    adapter = createStripeAdapter(config)
  })

  it('exposes STRIPE provider', () => {
    expect(adapter.provider).toBe(PaymentProvider.STRIPE)
  })

  describe('createIntent', () => {
    it('creates a Stripe payment intent', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        id: 'pi_123',
        status: 'requires_confirmation',
        amount: 1000000,
        currency: 'usd',
        metadata: {},
        created: 1700000000,
        client_secret: 'cs_test',
      }))

      const result = await adapter.createIntent({
        orderId: 'ord-1',
        userId: 'user-1',
        amount: 10000,
        currency: 'USD',
        method: 'card',
        provider: PaymentProvider.STRIPE,
        idempotencyKey: 'idem-1',
      })

      expect(result.id).toBe('pi_123')
      expect(result.status).toBe(PaymentIntentStatus.CREATED)
      expect(result.provider).toBe(PaymentProvider.STRIPE)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.stripe.com/v1/payment_intents',
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('maps processing status', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        id: 'pi_proc',
        status: 'processing',
        amount: 500,
        currency: 'usd',
        metadata: {},
        created: 1700000000,
        client_secret: 'cs_proc',
      }))

      const result = await adapter.createIntent({
        orderId: 'ord-2',
        userId: 'user-1',
        amount: 5,
        currency: 'USD',
        method: 'card',
        provider: PaymentProvider.STRIPE,
        idempotencyKey: 'idem-2',
      })
      expect(result.status).toBe(PaymentIntentStatus.PROCESSING)
    })

    it('throws on Stripe API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: { message: 'Invalid amount' } }),
      })

      await expect(adapter.createIntent({
        orderId: 'ord-3',
        userId: 'user-1',
        amount: -1,
        currency: 'USD',
        method: 'card',
        provider: PaymentProvider.STRIPE,
        idempotencyKey: 'idem-3',
      })).rejects.toThrow('Stripe API error')
    })
  })

  describe('captureIntent', () => {
    it('captures and fetches receipt URL', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse({
          id: 'pi_cap',
          status: 'succeeded',
          amount: 1000,
          currency: 'usd',
          metadata: {},
          created: 1700000000,
          client_secret: 'cs_cap',
          latest_charge: 'ch_abc',
        }))
        .mockResolvedValueOnce(jsonResponse({
          id: 'ch_abc',
          amount: 1000,
          receipt_url: 'https://receipt.stripe.com/ch_abc',
          created: 1700000000,
        }))

      const capture = await adapter.captureIntent('pi_cap')
      expect(capture.intentId).toBe('pi_cap')
      expect(capture.capturedAmount).toBe(10) // 1000 cents / 100
      expect(capture.receiptUrl).toBe('https://receipt.stripe.com/ch_abc')
    })

    it('handles capture without latest_charge', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        id: 'pi_nochg',
        status: 'succeeded',
        amount: 500,
        currency: 'usd',
        metadata: {},
        created: 1700000000,
        client_secret: 'cs_nochg',
      }))

      const capture = await adapter.captureIntent('pi_nochg')
      expect(capture.receiptUrl).toBeNull()
      expect(capture.providerTransactionId).toBe('pi_nochg')
    })
  })

  describe('refundIntent', () => {
    it('creates a refund', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse({
          id: 'pi_ref',
          status: 'succeeded',
          amount: 1000,
          currency: 'usd',
          metadata: {},
          created: 1700000000,
        }))
        .mockResolvedValueOnce(jsonResponse({
          id: 're_123',
          amount: 500,
          status: 'succeeded',
          created: 1700000001,
        }))

      const refund = await adapter.refundIntent('pi_ref', 5, 'duplicate')
      expect(refund.id).toBe('re_123')
      expect(refund.amount).toBe(5) // 500 cents / 100
      expect(refund.status).toBe(RefundStatus.COMPLETED)
    })

    it('maps processing refund status', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ id: 'pi_ref2' }))
        .mockResolvedValueOnce(jsonResponse({
          id: 're_pend',
          amount: 300,
          status: 'pending',
          created: 1700000001,
        }))

      const refund = await adapter.refundIntent('pi_ref2', 3, 'requested')
      expect(refund.status).toBe(RefundStatus.PROCESSING)
    })
  })

  describe('createPayout', () => {
    it('creates a Stripe payout', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        id: 'po_stripe',
        amount: 500000,
        currency: 'usd',
        status: 'paid',
        created: 1700000000,
        arrival_date: 1700086400,
      }))

      const result = await adapter.createPayout({
        id: 'po-1',
        recipientId: 'artist-1',
        amount: 5000,
        currency: 'USD',
        method: 'card',
        provider: PaymentProvider.STRIPE,
        destination: { type: 'bank', accountIdentifier: 'ba_123', accountName: 'Artist' },
        status: PayoutStatus.PENDING,
        providerPayoutId: null,
        batchId: null,
        scheduledAt: new Date(),
        completedAt: null,
      })

      expect(result.providerPayoutId).toBe('po_stripe')
      expect(result.status).toBe(PayoutStatus.COMPLETED)
    })

    it('maps non-paid payout status to PROCESSING', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        id: 'po_pend',
        amount: 100000,
        currency: 'usd',
        status: 'pending',
        created: 1700000000,
        arrival_date: 1700086400,
      }))

      const result = await adapter.createPayout({
        id: 'po-2',
        recipientId: 'artist-2',
        amount: 1000,
        currency: 'USD',
        method: 'card',
        provider: PaymentProvider.STRIPE,
        destination: { type: 'bank', accountIdentifier: 'ba_456', accountName: 'Artist 2' },
        status: PayoutStatus.PENDING,
        providerPayoutId: null,
        batchId: null,
        scheduledAt: new Date(),
        completedAt: null,
      })

      expect(result.status).toBe(PayoutStatus.PROCESSING)
      expect(result.completedAt).toBeNull()
    })
  })

  describe('verifyWebhook', () => {
    it('returns true for valid signature', () => {
      const now = Math.floor(Date.now() / 1000)
      expect(adapter.verifyWebhook(`t=${now},v1=abc123`, '{}')).toBe(true)
    })

    it('returns false for missing timestamp', () => {
      expect(adapter.verifyWebhook('v1=abc123', '{}')).toBe(false)
    })

    it('returns false for missing v1 signature', () => {
      expect(adapter.verifyWebhook('t=12345', '{}')).toBe(false)
    })

    it('returns false for stale timestamp', () => {
      const old = Math.floor(Date.now() / 1000) - 600
      expect(adapter.verifyWebhook(`t=${old},v1=abc123`, '{}')).toBe(false)
    })

    it('returns false for empty expected signature', () => {
      const now = Math.floor(Date.now() / 1000)
      expect(adapter.verifyWebhook(`t=${now},v1=`, '{}')).toBe(false)
    })
  })

  describe('connectAccountId', () => {
    it('includes Stripe-Account header when connectAccountId set', async () => {
      const connectAdapter = createStripeAdapter({ ...config, connectAccountId: 'acct_123' })
      mockFetch.mockResolvedValueOnce(jsonResponse({
        id: 'pi_conn',
        status: 'requires_confirmation',
        amount: 100,
        currency: 'usd',
        metadata: {},
        created: 1700000000,
        client_secret: 'cs_conn',
      }))

      await connectAdapter.createIntent({
        orderId: 'ord-conn',
        userId: 'user-1',
        amount: 1,
        currency: 'USD',
        method: 'card',
        provider: PaymentProvider.STRIPE,
        idempotencyKey: 'idem-conn',
      })

      const fetchCall = mockFetch.mock.calls[0]!
      expect(fetchCall[1].headers['Stripe-Account']).toBe('acct_123')
    })
  })
})
