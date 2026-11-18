import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '../payments/webhooks/paypal/route'
const provider = vi.fn()
beforeEach(() => {
  process.env.PAYPAL_CLIENT_ID = 'synthetic-component-client'
  process.env.PAYPAL_CLIENT_SECRET = 'synthetic-component-secret'
  process.env.PAYPAL_WEBHOOK_ID = 'synthetic-component-webhook'
  vi.stubGlobal('fetch', provider)
  provider.mockReset()
  provider.mockImplementation(
    async (url: string) =>
      new Response(
        JSON.stringify(
          url.endsWith('/oauth2/token')
            ? { access_token: 'synthetic-verifier-token' }
            : { verification_status: 'SUCCESS' },
        ),
        { status: 200 },
      ),
  )
})
afterEach(() => {
  delete process.env.PAYPAL_CLIENT_ID
  delete process.env.PAYPAL_CLIENT_SECRET
  delete process.env.PAYPAL_WEBHOOK_ID
  vi.unstubAllGlobals()
})
function request(eventType: string, signature = true, body?: string) {
  return new NextRequest('http://localhost/api/payments/webhooks/paypal', {
    method: 'POST',
    headers: signature
      ? {
          'paypal-transmission-id': 'synthetic-id',
          'paypal-transmission-time': new Date().toISOString(),
          'paypal-transmission-sig': 'synthetic-signature',
          'paypal-cert-url': 'https://api.paypal.com/synthetic-cert',
          'paypal-auth-algo': 'SHA256withRSA',
        }
      : {},
    body:
      body ??
      JSON.stringify({
        id: 'synthetic-event',
        event_type: eventType,
        resource: { id: 'capture', custom_id: 'transaction', amount: { value: '12.00' } },
      }),
  })
}
describe('PayPal authenticates delivery without authorizing deferred dues finance', () => {
  it('refuses missing signature headers before verification or effects', async () => {
    expect((await POST(request('PAYMENT.CAPTURE.COMPLETED', false))).status).toBe(400)
    expect(provider).not.toHaveBeenCalled()
  })
  it('rejects invalid provider verification instead of reporting unavailable', async () => {
    provider.mockImplementation(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url.endsWith('/oauth2/token')
              ? { access_token: 'synthetic-verifier-token' }
              : { verification_status: 'FAILURE' },
          ),
          { status: 200 },
        ),
    )
    expect((await POST(request('PAYMENT.CAPTURE.COMPLETED'))).status).toBe(400)
  })
  it.each([
    'PAYMENT.CAPTURE.COMPLETED',
    'PAYMENT.CAPTURE.DENIED',
    'PAYMENT.CAPTURE.FAILED',
    'PAYMENT.CAPTURE.REFUNDED',
  ])('verified %s cannot credit or record a financial receipt', async (eventType) => {
    const response = await POST(request(eventType))
    expect(response.status).toBe(501)
    expect(await response.json()).toMatchObject({ received: false, code: 'NOT_IMPLEMENTED' })
    expect(provider).toHaveBeenCalledTimes(2)
    expect(
      provider.mock.calls.every(([url]) =>
        String(url).startsWith('https://api-m.sandbox.paypal.com/'),
      ),
    ).toBe(true)
  })
  it('keeps an authenticated unrelated event ignored', async () => {
    const response = await POST(request('UNRELATED.EVENT'))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ status: 'ignored' })
  })
  it('fails closed on verification outage without treating it as a valid delivery', async () => {
    provider.mockRejectedValue(new Error('synthetic verification outage'))
    expect((await POST(request('PAYMENT.CAPTURE.COMPLETED'))).status).toBe(500)
  })
})
