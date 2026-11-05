import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

// Migration 20261102 removes purchaser data the Shopify webhook used to store. It is a one-way redaction and must be repeatable.
const SQL = readFileSync(resolve(__dirname, '../migrations/20261102_redact_shopify_purchaser_data.sql'), 'utf8');
const PURCHASER = /p@x\.ca|Pat|Jacket|personal|UEABC/;

let pg: PGlite;

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`
    CREATE TABLE webhook_receipts (id serial primary key, provider text, webhook_id text, event_type text, payload_json jsonb);
    CREATE TABLE reward_redemptions (id serial primary key, provider_payload_json jsonb);
    INSERT INTO webhook_receipts (provider, webhook_id, event_type, payload_json) VALUES
      ('shopify','a','orders/paid','{"id": 555, "customer": {"email":"p@x.ca"}, "discount_codes":[{"code":"UEABC"}]}'),
      ('shopify','b','refunds/create','{"id": 9001, "order_id": 555, "note":"personal"}'),
      ('shopify','c','orders/paid','{"topic":"orders/paid","order_id":"7","redacted":true}'),
      ('paypal','d','payment','{"payer":"keep"}');
    INSERT INTO reward_redemptions (provider_payload_json) VALUES
      ('{"order_number":1001,"customer":{"id":7,"email":"p@x.ca","first_name":"Pat"},"line_items":[{"product_id":1,"title":"Jacket for Pat","quantity":2}],"checkoutUrl":"u"}'),
      ('{"checkoutUrl":"https://s/c"}'),
      (NULL),
      ('{"line_items":"not-an-array","customer":{"x":1}}'),
      ('{"order":{"line_items":[{"product_id":1}]},"refunds":[]}');
  `);
  await pg.exec(SQL);
});
afterAll(async () => { await pg.close(); });

const receipts = async () => (await pg.query<{ webhook_id: string; payload_json: Record<string, unknown> }>('SELECT webhook_id, payload_json FROM webhook_receipts ORDER BY webhook_id')).rows;
const redemptions = async () => (await pg.query<{ provider_payload_json: unknown }>('SELECT provider_payload_json FROM reward_redemptions ORDER BY id')).rows.map((r) => r.provider_payload_json);

describe('migration 20261102 — Shopify purchaser data redaction', () => {
  it('reduces every Shopify receipt to which event it was and what it referred to', async () => {
    const rows = await receipts();
    expect(rows.find((r) => r.webhook_id === 'a')!.payload_json).toEqual({ topic: 'orders/paid', order_id: '555', redacted: true });
    expect(rows.find((r) => r.webhook_id === 'b')!.payload_json).toEqual({ topic: 'refunds/create', order_id: '555', refund_id: '9001', redacted: true });
    expect(rows.find((r) => r.webhook_id === 'c')!.payload_json).toEqual({ topic: 'orders/paid', order_id: '7', redacted: true });
  });

  it('leaves other providers\' receipts alone', async () => {
    expect((await receipts()).find((r) => r.webhook_id === 'd')!.payload_json).toEqual({ payer: 'keep' });
  });

  it('removes the customer and line-item titles from redemptions and keeps everything else', async () => {
    const rows = await redemptions();
    expect(rows[0]).toEqual({ order_number: 1001, checkoutUrl: 'u', line_items: [{ product_id: 1, quantity: 2 }] });
    expect(rows[1]).toEqual({ checkoutUrl: 'https://s/c' });
    expect(rows[2]).toBeNull();
    expect(rows[3]).toEqual({ line_items: 'not-an-array' });
    expect(rows[4]).toEqual({ order: { line_items: [{ product_id: 1 }] }, refunds: [] });
  });

  it('leaves no purchaser data anywhere, and running it again changes nothing', async () => {
    const before = JSON.stringify([await receipts(), await redemptions()]);
    expect(before).not.toMatch(PURCHASER);
    await pg.exec(SQL);
    expect(JSON.stringify([await receipts(), await redemptions()])).toBe(before);
  });
});
