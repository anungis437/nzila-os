import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  verifyShopifySignature: vi.fn(),
  parseShopifyHeaders: vi.fn(),
  processWebhookIdempotent: vi.fn(),
  extractRedemptionIdFromDiscount: vi.fn(),
  markRedemptionOrdered: vi.fn(),
  markRedemptionFulfilled: vi.fn(),
  processRedemptionRefund: vi.fn(),
  getRedemptionByOrderId: vi.fn(),
  getRedemptionByIdInternal: vi.fn(),
  checkRateLimit: vi.fn(),
  createRateLimitHeaders: vi.fn(),
  toCents: vi.fn(),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/services/rewards/webhook-service', () => ({
  verifyShopifySignature: m.verifyShopifySignature,
  parseShopifyHeaders: m.parseShopifyHeaders,
  processWebhookIdempotent: m.processWebhookIdempotent,
  extractRedemptionIdFromDiscount: m.extractRedemptionIdFromDiscount,
}));

vi.mock('@/lib/services/rewards/redemption-service', () => ({
  markRedemptionOrdered: m.markRedemptionOrdered,
  markRedemptionFulfilled: m.markRedemptionFulfilled,
  processRedemptionRefund: m.processRedemptionRefund,
  getRedemptionByOrderId: m.getRedemptionByOrderId,
  getRedemptionByIdInternal: m.getRedemptionByIdInternal,
}));

vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  createRateLimitHeaders: m.createRateLimitHeaders,
  RATE_LIMITS: {
    WEBHOOK_CALLS: { requests: 120, window: 60 },
  },
}));

vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/decimal-safe', () => ({ toCents: m.toCents }));

function requestWithBody(body: string, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/integrations/shopify/webhooks', {
    method: 'POST',
    body,
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '127.0.0.1',
      ...headers,
    },
  });
}

async function loadRoute() {
  return import('../integrations/shopify/webhooks/route');
}

describe('integrations/shopify/webhooks route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SHOPIFY_WEBHOOK_SECRET = 'shopify-secret';

    m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 0, remaining: 99 });
    m.createRateLimitHeaders.mockReturnValue({ 'x-ratelimit-remaining': '99' });
    m.parseShopifyHeaders.mockReturnValue({
      topic: 'orders/paid',
      webhookId: 'wh_1',
      hmac: 'hmac',
    });
    m.verifyShopifySignature.mockReturnValue(true);
    m.processWebhookIdempotent.mockImplementation(
      async (
        _provider: string,
        _webhookId: string,
        _topic: string,
        _payload: Record<string, unknown>,
        handler: () => Promise<unknown>,
      ) => handler(),
    );
    m.extractRedemptionIdFromDiscount.mockReturnValue('red_1');
    m.getRedemptionByIdInternal.mockResolvedValue({ id: 'red_1', orgId: 'org_1', creditsSpent: 100 });
    m.getRedemptionByOrderId.mockResolvedValue({ id: 'red_1', orgId: 'org_1', creditsSpent: 100 });
    m.toCents.mockImplementation((value: string) => Math.round(Number(value) * 100));
    m.markRedemptionOrdered.mockResolvedValue(undefined);
    m.markRedemptionFulfilled.mockResolvedValue(undefined);
    m.processRedemptionRefund.mockResolvedValue(undefined);
  });

  it('returns health payload on GET', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/integrations/shopify/webhooks'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.supported_topics).toContain('orders/paid');
  });

  it('returns 429 when webhook rate limit is exceeded', async () => {
    const { POST } = await loadRoute();
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false, resetIn: 30 });

    const response = await POST(requestWithBody('{}'));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({ error: 'Rate limit exceeded' });
  });

  it('returns validation error for missing required Shopify headers', async () => {
    const { POST } = await loadRoute();
    m.parseShopifyHeaders.mockReturnValueOnce({ topic: null, webhookId: null, hmac: null });

    const response = await POST(requestWithBody('{}'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('returns 500 when webhook secret is not configured', async () => {
    const { POST } = await loadRoute();
    delete process.env.SHOPIFY_WEBHOOK_SECRET;

    const response = await POST(requestWithBody('{}'));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: 'Webhook secret not configured' });
  });

  it('returns validation error for invalid signature', async () => {
    const { POST } = await loadRoute();
    m.verifyShopifySignature.mockReturnValueOnce(false);

    const response = await POST(requestWithBody('{"id":1}'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR', message: 'Invalid signature' });
  });

  it('handles orders/paid with no redemption discount as ignored', async () => {
    const { POST } = await loadRoute();
    m.extractRedemptionIdFromDiscount.mockReturnValueOnce(null);

    const response = await POST(requestWithBody(JSON.stringify({
      id: 'order_1',
      order_number: 101,
      discount_codes: [],
    })));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.result).toMatchObject({ status: 'ignored', reason: 'no_redemption_discount' });
  });

  it('handles orders/paid and marks redemption as ordered', async () => {
    const { POST } = await loadRoute();

    const response = await POST(requestWithBody(JSON.stringify({
      id: 'order_2',
      event_type: 'orders/paid',
      order_number: 102,
      discount_codes: [{ code: 'UNIONEYES_RED_1' }],
      total_price: '25.00',
      currency: 'CAD',
      line_items: [{ product_id: 'prod_1', quantity: 1, price: '25.00' }],
      customer: { id: 'cust_1', email: 'member@example.com' },
      created_at: '2026-06-11T00:00:00Z',
    }), {
      'x-shopify-topic': 'orders/paid',
      'x-shopify-webhook-id': 'wh_paid_1',
      'x-shopify-hmac-sha256': 'hmac',
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(m.markRedemptionOrdered).toHaveBeenCalled();
  });

  it('handles orders/fulfilled and marks redemption fulfilled', async () => {
    const { POST } = await loadRoute();
    m.parseShopifyHeaders.mockReturnValueOnce({ topic: 'orders/fulfilled', webhookId: 'wh_ful_1', hmac: 'hmac' });

    const response = await POST(requestWithBody(JSON.stringify({
      id: 'order_3',
      order_number: 103,
      fulfillments: [{ id: 'ful_1', tracking_number: 'TRK1', tracking_company: 'Carrier' }],
    })));

    expect(response.status).toBe(200);
    expect(m.markRedemptionFulfilled).toHaveBeenCalled();
  });

  it('handles refunds/create and processes redemption refund', async () => {
    const { POST } = await loadRoute();
    m.parseShopifyHeaders.mockReturnValueOnce({ topic: 'refunds/create', webhookId: 'wh_ref_1', hmac: 'hmac' });

    const response = await POST(requestWithBody(JSON.stringify({
      id: 'refund_1',
      order_id: 'order_4',
      currency: 'CAD',
      refund_line_items: [{ line_item_id: 'li_1', subtotal: '10.25', quantity: 1 }],
      created_at: '2026-06-11T00:00:00Z',
    })));

    expect(response.status).toBe(200);
    expect(m.processRedemptionRefund).toHaveBeenCalledWith(
      'red_1',
      'org_1',
      expect.objectContaining({ refund_amount: 10.25, refund_id: 'refund_1' }),
    );
  });

  it('returns non-retrying 200 envelope on unexpected processing errors', async () => {
    const { POST } = await loadRoute();
    m.processWebhookIdempotent.mockRejectedValueOnce(new Error('unexpected failure'));

    const response = await POST(requestWithBody('{"id":"order_5"}'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ received: true, error: 'Internal processing error' });
  });
});
