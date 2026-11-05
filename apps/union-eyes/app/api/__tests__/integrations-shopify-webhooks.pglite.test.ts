import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'crypto';
import { NextRequest } from 'next/server';
import type { PGlite } from '@electric-sql/pglite';
import { rewardRedemptions, rewardWalletLedger, shopifyConfig, webhookReceipts } from '@/db/schema';
import { drizzle } from 'drizzle-orm/pglite';
import { createTableDatabase } from './support/pglite-tables';

// The Shopify webhook against real SQL: the redemption lifecycle, the discount code the flow issues, partial refunds, retries
// and the data the receipt and the redemption keep.

const state = vi.hoisted(() => ({ db: null as unknown, contexts: [] as unknown[], limitKeys: [] as string[] }));
const audit = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('@/db', async () => {
  const { lateBoundDb } = await import('./support/pglite-tables');
  return { db: lateBoundDb(state) };
});
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: async (fn: (tx: unknown) => Promise<unknown>) => fn(state.db),
  withRLSContext: async (context: unknown, fn: (tx: unknown) => Promise<unknown>) => {
    state.contexts.push(context);
    return fn(state.db);
  },
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: audit }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn(async (key: string) => {
    state.limitKeys.push(key);
    return { allowed: true, resetIn: 0, remaining: 10 };
  }),
  createRateLimitHeaders: () => ({}),
  RATE_LIMITS: { WEBHOOK_CALLS: { limit: 300, window: 3600, identifier: 'webhook-calls' } },
}));

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const PROGRAM = '99999999-9999-4999-8999-999999999999';
const SECRET = 'shopify-test-secret';
const SHOP_A = 'shop-a.myshopify.com';
const SHOP_B = 'shop-b.myshopify.com';

let pg: PGlite;

const redemptionId = () => crypto.randomUUID();

async function insertRedemption(orgId: string, status = 'pending_payment', credits = 1000, id = redemptionId()) {
  await pg.query(
    `INSERT INTO reward_redemptions (id, org_id, user_id, program_id, credits_spent, status, provider, provider_checkout_id, provider_payload_json)
     VALUES ($1, $2, 'member-1', $3, $4, $5, 'shopify', 'chk_1', '{"checkoutUrl":"https://shop/checkout"}'::jsonb)`,
    [id, orgId, PROGRAM, credits, status],
  );
  return id;
}
const redemption = async (id: string) =>
  (await pg.query<{ status: string; provider_order_id: string | null; provider_payload_json: Record<string, any> }>(
    'SELECT status, provider_order_id, provider_payload_json FROM reward_redemptions WHERE id = $1', [id])).rows[0];
const receipts = async () => (await pg.query<{ webhook_id: string; payload_json: Record<string, unknown> }>('SELECT webhook_id, payload_json FROM webhook_receipts ORDER BY created_at')).rows;
const refundEntries = async () => (await pg.query<{ amount_credits: number; balance_after: number }>(
  `SELECT amount_credits, balance_after FROM reward_wallet_ledger WHERE event_type = 'refund' ORDER BY created_at`)).rows;

const paidOrder = (orderId: number, code: string) => ({
  id: orderId, order_number: 1001, currency: 'CAD', total_price: '0.00', total_line_items_price: '50.00', created_at: '2026-01-01T00:00:00Z',
  discount_codes: [{ code }],
  customer: { id: 7, email: 'person@example.com', first_name: 'Pat', last_name: 'Member' },
  email: 'person@example.com',
  line_items: [{ product_id: 1, variant_id: 2, title: 'Jacket for Pat', quantity: 2, price: '25.00' }],
});

async function deliver(topic: string, body: Record<string, unknown>, opts: { webhookId?: string; shop?: string; secret?: string; forwardedFor?: string } = {}) {
  const raw = JSON.stringify(body);
  const hmac = crypto.createHmac('sha256', opts.secret ?? SECRET).update(raw, 'utf8').digest('base64');
  const { POST } = await import('../integrations/shopify/webhooks/route');
  return POST(new NextRequest('http://localhost/api/integrations/shopify/webhooks', {
    method: 'POST',
    body: raw,
    headers: {
      'content-type': 'application/json',
      'x-shopify-hmac-sha256': hmac,
      'x-shopify-topic': topic,
      'x-shopify-shop-domain': opts.shop ?? SHOP_A,
      'x-shopify-webhook-id': opts.webhookId ?? crypto.randomUUID(),
      'x-forwarded-for': opts.forwardedFor ?? '203.0.113.7',
    },
  }));
}

beforeAll(async () => {
  const created = await createTableDatabase([rewardRedemptions, rewardWalletLedger, shopifyConfig, webhookReceipts]);
  pg = created.pg;
  // the services use the relational query API, so the handle carries the schema
  state.db = drizzle(created.pg, { schema: { rewardRedemptions, rewardWalletLedger, shopifyConfig, webhookReceipts } });
  process.env.SHOPIFY_WEBHOOK_SECRET = SECRET;
});
afterAll(async () => {
  delete process.env.SHOPIFY_WEBHOOK_SECRET;
  await pg.close();
});
beforeEach(async () => {
  audit.mockReset();
  audit.mockResolvedValue(undefined);
  state.contexts = [];
  state.limitKeys = [];
  await pg.exec('TRUNCATE reward_redemptions, reward_wallet_ledger, shopify_config, webhook_receipts');
  for (const [org, shop] of [[ORG_A, SHOP_A], [ORG_B, SHOP_B]]) {
    await pg.query(`INSERT INTO shopify_config (org_id, shop_domain, storefront_token_secret_ref, webhook_secret_ref) VALUES ($1, $2, 'ref', 'ref')`, [org, shop]);
  }
});

const { discountCodeFor } = await import('@/lib/services/rewards/shopify-redemption-rules');

describe('shopify webhook — the redemption lifecycle', () => {
  it('moves a redemption from paid through fulfilled to refunded, in the shop\'s organization', async () => {
    const id = await insertRedemption(ORG_A);
    expect((await deliver('orders/paid', paidOrder(555, discountCodeFor(id)))).status).toBe(200);

    let row = await redemption(id);
    expect(row.status).toBe('ordered');
    expect(row.provider_order_id).toBe('555');
    expect(row.provider_payload_json.checkoutUrl).toBe('https://shop/checkout');
    expect(row.provider_payload_json.order.line_items_total_cents).toBe(5000);
    expect(state.contexts).toContainEqual(expect.objectContaining({ organizationId: ORG_A }));

    expect((await deliver('orders/fulfilled', { id: 555, fulfillments: [{ id: 1, tracking_number: 'T1', status: 'success' }] })).status).toBe(200);
    row = await redemption(id);
    expect(row.status).toBe('fulfilled');
    expect(row.provider_payload_json.order).toBeDefined();
    expect(row.provider_payload_json.fulfillment.tracking_number).toBe('T1');

    expect((await deliver('refunds/create', { id: 9001, order_id: 555, refund_line_items: [{ subtotal: '50.00' }] })).status).toBe(200);
    expect((await redemption(id)).status).toBe('refunded');
    expect(await refundEntries()).toEqual([{ amount_credits: 1000, balance_after: 1000 }]);
  });

  it('resolves a code issued before the format was fixed (first 12 characters) inside the shop\'s organization only', async () => {
    const id = await insertRedemption(ORG_A);
    const legacy = `UE${id.replace(/-/g, '').slice(0, 12).toUpperCase()}`;
    expect((await deliver('orders/paid', paidOrder(556, legacy))).status).toBe(200);
    expect((await redemption(id)).status).toBe('ordered');
  });

  it('does not let a shop reach another organization\'s redemption by its code', async () => {
    const foreign = await insertRedemption(ORG_B);
    const response = await deliver('orders/paid', paidOrder(557, discountCodeFor(foreign)), { shop: SHOP_A });
    expect(JSON.stringify(await response.json())).toContain('redemption_not_found');
    expect((await redemption(foreign)).status).toBe('pending_payment');
  });
});

describe('shopify webhook — retries and failures', () => {
  it('asks Shopify to redeliver a fulfilment that beats the paid event, and applies it on redelivery', async () => {
    const id = await insertRedemption(ORG_A);
    const early = await deliver('orders/fulfilled', { id: 600, fulfillments: [] }, { webhookId: 'wh-early' });
    expect(early.status).toBe(503);
    expect(await receipts()).toEqual([]);

    await deliver('orders/paid', paidOrder(600, discountCodeFor(id)), { webhookId: 'wh-paid' });
    const again = await deliver('orders/fulfilled', { id: 600, fulfillments: [] }, { webhookId: 'wh-early' });
    expect(again.status).toBe(200);
    expect((await redemption(id)).status).toBe('fulfilled');
    expect((await receipts()).map((r) => r.webhook_id).sort()).toEqual(['wh-early', 'wh-paid']);
  });

  it('answers 500 for a failure, records no receipt, and applies the redelivery', async () => {
    const id = await insertRedemption(ORG_A);
    audit.mockRejectedValueOnce(new Error('audit unavailable'));
    const failed = await deliver('orders/paid', paidOrder(601, discountCodeFor(id)), { webhookId: 'wh-fail' });
    expect(failed.status).toBe(500);
    expect(await receipts()).toEqual([]);
    expect((await redemption(id)).status).toBe('pending_payment');

    expect((await deliver('orders/paid', paidOrder(601, discountCodeFor(id)), { webhookId: 'wh-fail' })).status).toBe(200);
    expect((await redemption(id)).status).toBe('ordered');
  });

  it('treats a repeated delivery as one application, whether or not the receipt exists yet', async () => {
    const id = await insertRedemption(ORG_A);
    await deliver('orders/paid', paidOrder(602, discountCodeFor(id)), { webhookId: 'wh-1' });
    const sameId = await deliver('orders/paid', paidOrder(602, discountCodeFor(id)), { webhookId: 'wh-1' });
    expect(sameId.status).toBe(200);
    expect(JSON.stringify(await sameId.json())).toContain('already_processed');
    // a new delivery id for the same order (Shopify resends) is also harmless
    expect((await deliver('orders/paid', paidOrder(602, discountCodeFor(id)), { webhookId: 'wh-2' })).status).toBe(200);
    expect((await redemption(id)).status).toBe('ordered');
  });
});

describe('shopify webhook — refunds', () => {
  it('asks Shopify to redeliver a refund for an order that has not been recorded as paid', async () => {
    const response = await deliver('refunds/create', { id: 5, order_id: 424242, refund_line_items: [{ subtotal: '5.00' }] }, { webhookId: 'wh-refund-early' });
    expect(response.status).toBe(503);
    expect(await receipts()).toEqual([]);
    expect(await refundEntries()).toEqual([]);
  });

  async function ordered(credits = 1000) {
    const id = await insertRedemption(ORG_A, 'pending_payment', credits);
    await deliver('orders/paid', paidOrder(700, discountCodeFor(id)));
    return id;
  }

  it('returns only the refunded share for a partial refund, and keeps the redemption open', async () => {
    const id = await ordered();
    await deliver('refunds/create', { id: 1, order_id: 700, refund_line_items: [{ subtotal: '12.50' }] });
    expect(await refundEntries()).toEqual([{ amount_credits: 250, balance_after: 250 }]);
    expect((await redemption(id)).status).toBe('ordered');
  });

  it('applies each refund once and returns exactly what was spent across all of them', async () => {
    const id = await ordered();
    await deliver('refunds/create', { id: 1, order_id: 700, refund_line_items: [{ subtotal: '12.50' }] });
    await deliver('refunds/create', { id: 1, order_id: 700, refund_line_items: [{ subtotal: '12.50' }] }, { webhookId: 'again' });
    await deliver('refunds/create', { id: 2, order_id: 700, refund_line_items: [{ subtotal: '37.50' }] });

    expect((await refundEntries()).map((e) => e.amount_credits)).toEqual([250, 750]);
    expect((await redemption(id)).status).toBe('refunded');
    // a refund arriving after everything is back returns nothing more
    await deliver('refunds/create', { id: 3, order_id: 700, refund_line_items: [{ subtotal: '5.00' }] });
    expect((await refundEntries()).reduce((sum, e) => sum + e.amount_credits, 0)).toBe(1000);
  });
});

describe('shopify webhook — what is kept', () => {
  it('stores no purchaser data in the redemption or the receipt', async () => {
    const id = await insertRedemption(ORG_A);
    await deliver('orders/paid', paidOrder(800, discountCodeFor(id)), { webhookId: 'wh-pii' });
    const stored = JSON.stringify([await redemption(id), await receipts()]);
    expect(stored).not.toMatch(/person@example|Pat|Member|Jacket|"customer"|UE[0-9A-F]{32}/);
    expect((await receipts())[0].payload_json).toMatchObject({ topic: 'orders/paid', shop_domain: SHOP_A, order_id: '800' });
  });
});

describe('shopify webhook — which shop sent it', () => {
  it('answers 500 when the webhook secret is not configured, before reading anything', async () => {
    const saved = process.env.SHOPIFY_WEBHOOK_SECRET;
    delete process.env.SHOPIFY_WEBHOOK_SECRET;
    try {
      expect((await deliver('orders/paid', paidOrder(1, 'X'))).status).toBe(500);
    } finally {
      process.env.SHOPIFY_WEBHOOK_SECRET = saved;
    }
  });

  it('refuses a request without the Shopify headers', async () => {
    const { POST } = await import('../integrations/shopify/webhooks/route');
    const response = await POST(new NextRequest('http://localhost/api/integrations/shopify/webhooks', { method: 'POST', body: '{}' }));
    expect(response.status).toBe(400);
  });

  it('refuses a validly signed event from a shop no organization has configured', async () => {
    const id = await insertRedemption(ORG_A);
    const response = await deliver('orders/paid', paidOrder(900, discountCodeFor(id)), { shop: 'stranger.myshopify.com' });
    expect(response.status).toBe(403);
    expect((await redemption(id)).status).toBe('pending_payment');
    expect(await receipts()).toEqual([]);
  });

  it('refuses a shop domain that two organizations have configured', async () => {
    await pg.query(`UPDATE shopify_config SET shop_domain = $1 WHERE org_id = $2`, [SHOP_A.toUpperCase(), ORG_B]);
    expect((await deliver('orders/paid', paidOrder(901, discountCodeFor(redemptionId())), { shop: SHOP_A })).status).toBe(403);
  });

  it('refuses a bad signature before touching anything', async () => {
    const id = await insertRedemption(ORG_A);
    const response = await deliver('orders/paid', paidOrder(902, discountCodeFor(id)), { secret: 'wrong' });
    expect(response.status).toBe(400);
    expect((await redemption(id)).status).toBe('pending_payment');
  });

  it('limits by one normalised address and by shop, not by the whole forwarded-for string', async () => {
    await deliver('orders/paid', paidOrder(903, 'NOPE'), { forwardedFor: '203.0.113.7, 10.0.0.1' });
    await deliver('orders/paid', paidOrder(904, 'NOPE'), { forwardedFor: '203.0.113.7, 10.0.0.99, 10.0.0.2' });
    expect(new Set(state.limitKeys.filter((k) => k.startsWith('webhook-shopify:')))).toEqual(new Set(['webhook-shopify:203.0.113.7']));
    expect(state.limitKeys).toContain(`webhook-shopify-shop:${SHOP_A}`);
  });
});
