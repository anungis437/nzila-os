import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockExecute = vi.fn().mockResolvedValue([])
const mockVerifyWebhookSignature = vi.fn()
const mockReconcileMpesaCallback = vi.fn()

vi.mock('@nzila/db/platform', () => ({
  platformDb: {
    execute: (...args: unknown[]) => mockExecute(...args),
  },
}))

vi.mock('@nzila/payments-stripe', () => ({
  verifyWebhookSignature: (...args: unknown[]) => mockVerifyWebhookSignature(...args),
  WebhookSignatureError: class WebhookSignatureError extends Error {
    constructor(msg: string) {
      super(msg)
      this.name = 'WebhookSignatureError'
    }
  },
}))

vi.mock('@/lib/vodacom-mpesa', () => ({
  isVodacomMpesaEnabled: () => true,
}))

vi.mock('@/lib/payments/mpesa-callback-service', () => ({
  MpesaCallbackSchema: {
    safeParse: (body: unknown) => ({ success: true, data: body }),
  },
  reconcileMpesaCallback: (...args: unknown[]) => mockReconcileMpesaCallback(...args),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

let stripePOST: (request: Request) => Promise<Response>
let mpesaPOST: (request: Request) => Promise<Response>

beforeEach(async () => {
  vi.clearAllMocks()

  const stripeRoute = await import('../../app/api/webhooks/stripe/route')
  stripePOST = stripeRoute.POST

  const mpesaRoute = await import('../../app/api/webhooks/mpesa/route')
  mpesaPOST = mpesaRoute.POST
})

describe('payment e2e routes', () => {
  it('processes Stripe checkout webhook end-to-end at route boundary', async () => {
    mockVerifyWebhookSignature.mockReturnValue({
      event: {
        type: 'checkout.session.completed',
        data: {
          object: {
            mode: 'subscription',
            subscription: 'sub_123',
            customer: 'cus_123',
            metadata: {
              plan_type: 'listener_premium',
              listener_id: '17d40fbd-fdb5-4c39-8891-4c5de80d7e20',
            },
          },
        },
      },
    })

    const req = new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig_ok' },
      body: '{}',
    })

    const res = await stripePOST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.received).toBe(true)
    expect(mockVerifyWebhookSignature).toHaveBeenCalled()
    expect(mockExecute).toHaveBeenCalled()
  })

  it('processes M-Pesa callback end-to-end at route boundary', async () => {
    mockReconcileMpesaCallback.mockResolvedValue({
      reconciled: true,
      idempotent: false,
      status: 'captured',
    })

    const req = new Request('http://localhost/api/webhooks/mpesa', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        output_ResponseCode: 'INS-0',
        output_ResponseDesc: 'Request processed successfully',
        output_TransactionID: 'TXN123',
        output_ConversationID: 'CONV123',
        output_ThirdPartyConversationID: 'idem_123',
      }),
    })

    const res = await mpesaPOST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.received).toBe(true)
    expect(body.reconciled).toBe(true)
    expect(mockReconcileMpesaCallback).toHaveBeenCalled()
  })
})
