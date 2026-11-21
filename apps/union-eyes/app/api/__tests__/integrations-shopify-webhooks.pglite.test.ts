import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createHmac } from 'node:crypto'
import { NextRequest } from 'next/server'
import { drizzle } from 'drizzle-orm/pglite'
import { createRewardsBoundaryFixture } from '@/db/__tests__/rewards-boundary-testkit'
const state = vi.hoisted(() => ({
  system: null as null | (<T>(operation: () => Promise<T>) => Promise<T>),
  db: null as unknown,
  tenant: vi.fn(),
}))
vi.mock('@/db', () => ({ db: {} }))
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: async (operation: (tx: unknown) => Promise<unknown>) => {
    if (!state.system) throw new Error('Missing actual restricted fixture')
    return state.system(() => operation(state.db))
  },
  withRLSContext: state.tenant,
}))
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: async () => ({ allowed: true, resetIn: 0, remaining: 10 }),
  createRateLimitHeaders: () => ({}),
  RATE_LIMITS: { WEBHOOK_CALLS: {} },
}))
import { POST } from '../integrations/shopify/webhooks/route'
const secret = 'synthetic-component-shopify-secret'
const shop = 'component-shop.myshopify.com'
let fixture: Awaited<ReturnType<typeof createRewardsBoundaryFixture>>
beforeAll(async () => {
  fixture = await createRewardsBoundaryFixture()
  state.db = drizzle(fixture.db)
  state.system = fixture.system
  process.env.UE_SHOPIFY_COMPONENT_SECRET = secret
  await fixture.db.query('UPDATE public.shopify_config SET shop_domain=$1', [shop])
  await fixture.db.query(
    "UPDATE public.shopify_webhook_secret_versions SET secret_ref='env://UE_SHOPIFY_COMPONENT_SECRET'",
  )
})
afterAll(async () => {
  delete process.env.UE_SHOPIFY_COMPONENT_SECRET
  await fixture?.db.close()
})
async function deliver(
  topic: string,
  options: { signature?: string; domain?: string; body?: string } = {},
) {
  const body =
    options.body ??
    JSON.stringify({ id: 'synthetic-order', discount_codes: [{ code: 'held-redemption' }] })
  return POST(
    new NextRequest('http://localhost/api/integrations/shopify/webhooks', {
      method: 'POST',
      body,
      headers: {
        'x-shopify-topic': topic,
        'x-shopify-shop-domain': options.domain ?? shop,
        'x-shopify-webhook-id': 'synthetic-webhook-delivery',
        'x-shopify-hmac-sha256':
          options.signature ?? createHmac('sha256', secret).update(body).digest('base64'),
      },
    }),
  )
}
describe('actual signature metadata reads precede deferred financial fulfillment', () => {
  it('rejects an invalid signature before receipt or business context', async () => {
    expect((await deliver('orders/paid', { signature: 'invalid' })).status).toBe(400)
    expect(state.tenant).not.toHaveBeenCalled()
  })
  it('refuses an unconfigured shop without trusting its claimed tenant', async () => {
    expect((await deliver('orders/paid', { domain: 'foreign-shop.myshopify.com' })).status).toBe(
      403,
    )
  })
  it.each(['orders/paid', 'orders/fulfilled', 'refunds/create'])(
    'authenticates %s but creates no financial receipt/effect',
    async (topic) => {
      const response = await deliver(topic)
      expect(response.status).toBe(501)
      expect(JSON.stringify(await response.json())).toContain('NOT_IMPLEMENTED')
      expect(state.tenant).not.toHaveBeenCalled()
      expect(
        (await fixture.db.query('SELECT count(*)::int AS n FROM public.webhook_receipts')).rows,
      ).toEqual([{ n: 0 }])
      expect(await fixture.preserved()).toEqual(fixture.history)
    },
  )
  it('retains valid-signature JSON validation before any effect', async () => {
    expect((await deliver('orders/paid', { body: 'malformed-json' })).status).toBe(400)
  })
  it('ignores an authenticated unsupported topic without recording a financial receipt', async () => {
    expect((await deliver('products/update')).status).toBe(200)
    expect(
      (await fixture.db.query('SELECT count(*)::int AS n FROM public.webhook_receipts')).rows,
    ).toEqual([{ n: 0 }])
  })
})
