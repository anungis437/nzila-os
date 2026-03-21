/**
 * Zonga — Stripe Webhook Handler Tests
 *
 * Tests the /api/webhooks/stripe POST handler for all subscription
 * lifecycle events: checkout.session.completed, customer.subscription.updated,
 * customer.subscription.deleted, invoice.paid.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

/* ── Mocks ── */

const mockExecute = vi.fn().mockResolvedValue([])
vi.mock('@nzila/db/platform', () => ({
  platformDb: { execute: (...args: unknown[]) => mockExecute(...args) },
}))

const mockVerifyWebhookSignature = vi.fn()
vi.mock('@nzila/payments-stripe', () => ({
  verifyWebhookSignature: (...args: unknown[]) => mockVerifyWebhookSignature(...args),
  WebhookSignatureError: class WebhookSignatureError extends Error {
    constructor(msg: string) { super(msg); this.name = 'WebhookSignatureError' }
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

/* ── Import after mocks ── */
// eslint-disable-next-line @typescript-eslint/no-require-imports
let POST: (request: Request) => Promise<Response>

beforeEach(async () => {
  vi.clearAllMocks()
  // Dynamic import to pick up mocks
  const mod = await import('../../app/api/webhooks/stripe/route')
  POST = mod.POST
})

/* ── Helpers ── */

function makeRequest(body: string, signature = 'sig_test') {
  return new Request('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'stripe-signature': signature },
    body,
  })
}

function fakeCheckoutSession(metadata: Record<string, string>) {
  return {
    type: 'checkout.session.completed',
    data: {
      object: {
        mode: 'subscription',
        subscription: 'sub_123',
        customer: 'cus_456',
        metadata,
      },
    },
  }
}

function fakeSubscriptionUpdated(metadata: Record<string, string>, status = 'active') {
  return {
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: 'sub_123',
        status,
        metadata,
        items: {
          data: [{ current_period_end: 1700000000 }],
        },
      },
    },
  }
}

function fakeSubscriptionDeleted(metadata: Record<string, string>) {
  return {
    type: 'customer.subscription.deleted',
    data: {
      object: {
        id: 'sub_123',
        status: 'canceled',
        metadata,
      },
    },
  }
}

function fakeInvoicePaid(subscriptionId = 'sub_123') {
  return {
    type: 'invoice.paid',
    data: {
      object: {
        subscription: subscriptionId,
      },
    },
  }
}

/* ── Tests ── */

describe('Stripe Webhook Handler', () => {
  describe('signature verification', () => {
    it('rejects requests without stripe-signature header', async () => {
      const req = new Request('http://localhost/api/webhooks/stripe', {
        method: 'POST',
        body: '{}',
      })
      const res = await POST(req)
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toContain('signature')
    })

    it('rejects invalid signatures', async () => {
      const { WebhookSignatureError } = await import('@nzila/payments-stripe')
      mockVerifyWebhookSignature.mockImplementation(() => {
        throw new WebhookSignatureError('bad sig')
      })
      const res = await POST(makeRequest('{}'))
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe('Invalid signature')
    })
  })

  describe('checkout.session.completed', () => {
    it('upgrades listener to premium on checkout completion', async () => {
      mockVerifyWebhookSignature.mockReturnValue({
        event: fakeCheckoutSession({
          plan_type: 'listener_premium',
          listener_id: 'lis_abc',
        }),
      })

      const res = await POST(makeRequest('{}'))
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.received).toBe(true)

      // Should have called platformDb.execute to update listener
      expect(mockExecute).toHaveBeenCalled()
    })

    it('upgrades creator to label plan on checkout completion', async () => {
      mockVerifyWebhookSignature.mockReturnValue({
        event: fakeCheckoutSession({
          plan_type: 'label',
          creator_id: 'cre_xyz',
        }),
      })

      const res = await POST(makeRequest('{}'))
      expect(res.status).toBe(200)
      expect(mockExecute).toHaveBeenCalled()
    })

    it('ignores non-subscription checkout sessions', async () => {
      mockVerifyWebhookSignature.mockReturnValue({
        event: {
          type: 'checkout.session.completed',
          data: {
            object: {
              mode: 'payment',
              metadata: {},
            },
          },
        },
      })

      const res = await POST(makeRequest('{}'))
      expect(res.status).toBe(200)
      // Should NOT have called execute for a non-subscription checkout
      expect(mockExecute).not.toHaveBeenCalled()
    })
  })

  describe('customer.subscription.updated', () => {
    it('updates listener subscription status', async () => {
      mockVerifyWebhookSignature.mockReturnValue({
        event: fakeSubscriptionUpdated(
          { plan_type: 'listener_premium', listener_id: 'lis_abc' },
          'past_due',
        ),
      })

      const res = await POST(makeRequest('{}'))
      expect(res.status).toBe(200)
      expect(mockExecute).toHaveBeenCalled()
    })

    it('updates creator subscription status', async () => {
      mockVerifyWebhookSignature.mockReturnValue({
        event: fakeSubscriptionUpdated(
          { plan_type: 'label', creator_id: 'cre_xyz' },
          'active',
        ),
      })

      const res = await POST(makeRequest('{}'))
      expect(res.status).toBe(200)
      expect(mockExecute).toHaveBeenCalled()
    })
  })

  describe('customer.subscription.deleted', () => {
    it('reverts listener to free on cancellation', async () => {
      mockVerifyWebhookSignature.mockReturnValue({
        event: fakeSubscriptionDeleted({ plan_type: 'listener_premium' }),
      })

      const res = await POST(makeRequest('{}'))
      expect(res.status).toBe(200)
      expect(mockExecute).toHaveBeenCalled()
    })

    it('reverts creator to artist on cancellation', async () => {
      mockVerifyWebhookSignature.mockReturnValue({
        event: fakeSubscriptionDeleted({ plan_type: 'label' }),
      })

      const res = await POST(makeRequest('{}'))
      expect(res.status).toBe(200)
      expect(mockExecute).toHaveBeenCalled()
    })
  })

  describe('invoice.paid', () => {
    it('sets subscription to active on invoice payment', async () => {
      mockVerifyWebhookSignature.mockReturnValue({
        event: fakeInvoicePaid('sub_123'),
      })

      const res = await POST(makeRequest('{}'))
      expect(res.status).toBe(200)
      // Should update both listeners and creators tables
      expect(mockExecute).toHaveBeenCalledTimes(2)
    })
  })

  describe('unhandled events', () => {
    it('ignores unknown event types gracefully', async () => {
      mockVerifyWebhookSignature.mockReturnValue({
        event: { type: 'payment_intent.succeeded', data: { object: {} } },
      })

      const res = await POST(makeRequest('{}'))
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.received).toBe(true)
    })
  })

  describe('error handling', () => {
    it('returns 500 when handler throws unexpectedly', async () => {
      mockVerifyWebhookSignature.mockReturnValue({
        event: fakeCheckoutSession({
          plan_type: 'listener_premium',
          listener_id: 'lis_abc',
        }),
      })
      mockExecute.mockRejectedValueOnce(new Error('DB connection lost'))

      const res = await POST(makeRequest('{}'))
      expect(res.status).toBe(500)
    })
  })
})
