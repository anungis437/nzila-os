/**
 * Square Payment Processor — Unit Tests
 *
 * Square talks to its REST API through global fetch (squareRequest always
 * parses JSON, then checks response.ok). We drive a queue-based fetch mock.
 * Webhook verification uses real node crypto HMAC, so tests compute the
 * expected signature with the same secret. Base-processor amount helpers
 * (convertAmount/formatAmount) stay real.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'crypto';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { SquareProcessor } from '../processors/square-processor';
import { PaymentStatus, WebhookEventType, PaymentMethodType } from '../types';
import { Decimal } from 'decimal.js';

let fetchQueue: Array<Record<string, unknown>>;
const realFetch = global.fetch;

function ok(data: unknown) {
  return { ok: true, statusText: 'OK', json: async () => data };
}
function fail(opts: { statusText?: string; errors?: unknown } = {}) {
  return {
    ok: false,
    statusText: opts.statusText ?? 'Bad Request',
    json: async () => (opts.errors !== undefined ? { errors: opts.errors } : {}),
  };
}
function push(...responses: Record<string, unknown>[]) {
  fetchQueue.push(...responses);
}

async function makeProcessor(opts: { env?: 'test' | 'production'; webhookSecret?: string } = {}) {
  const p = new SquareProcessor();
  await p.initialize({
    apiKey: 'access-token-1234',
    environment: opts.env ?? 'test',
    webhookSecret: opts.webhookSecret,
    metadata: { applicationId: 'app-id-1234' },
  });
  return p;
}

const payment = (over: Record<string, unknown> = {}) => ({
  id: 'pay_1',
  status: 'COMPLETED',
  amount_money: { amount: 1000, currency: 'USD' },
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  customer_id: 'cus_1',
  source_type: 'CARD',
  card_details: { card: { last_4: '4242', card_brand: 'VISA', exp_month: 12, exp_year: 2030 } },
  ...over,
});

const refundRow = (over: Record<string, unknown> = {}) => ({
  id: 'rf_1',
  status: 'COMPLETED',
  amount_money: { amount: 500, currency: 'USD' },
  created_at: '2024-01-01T00:00:00Z',
  payment_id: 'pay_1',
  ...over,
});

const customerRow = (over: Record<string, unknown> = {}) => ({
  id: 'cus_1',
  email_address: 'a@b.com',
  given_name: 'Alice',
  family_name: 'Smith',
  phone_number: '555',
  address: {
    address_line_1: 'L1',
    address_line_2: 'L2',
    locality: 'C',
    administrative_district_level_1: 'S',
    postal_code: 'P',
    country: 'CA',
  },
  created_at: '2024-01-01T00:00:00Z',
  ...over,
});

const cardRow = (over: Record<string, unknown> = {}) => ({
  id: 'card_1',
  card_brand: 'VISA',
  last_4: '4242',
  exp_month: 12,
  exp_year: 2030,
  customer_id: 'cus_1',
  ...over,
});

beforeEach(() => {
  fetchQueue = [];
  global.fetch = vi.fn(async () => {
    const next = fetchQueue.shift();
    if (!next) throw new Error('fetch queue empty');
    return next as unknown as Response;
  }) as unknown as typeof fetch;
  vi.clearAllMocks();
});
afterEach(() => {
  global.fetch = realFetch;
});

describe('SquareProcessor — initialize', () => {
  it('initializes in sandbox', async () => {
    const p = await makeProcessor();
    expect(p.type).toBe('square');
  });
  it('throws when applicationId is missing', async () => {
    const p = new SquareProcessor();
    await expect(
      p.initialize({ apiKey: 'tok', environment: 'test', metadata: {} }),
    ).rejects.toThrow('application ID');
  });
  it('uses the production base URL when not test env', async () => {
    const p = await makeProcessor({ env: 'production' });
    push(ok({ payment: payment() }));
    await p.retrievePaymentIntent('pay_1');
    const url = (global.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0];
    expect(String(url)).toContain('connect.squareup.com');
  });
});

describe('SquareProcessor — payment intents', () => {
  it('createPaymentIntent maps the payment (with metadata + source)', async () => {
    const p = await makeProcessor();
    push(ok({ payment: payment() }));
    const r = await p.createPaymentIntent({
      amount: new Decimal('10.00'),
      currency: 'usd',
      paymentMethodId: 'src_1',
      customerId: 'cus_1',
      description: 'desc',
      metadata: { referenceId: 'ref' },
      confirm: false,
    });
    expect(r.id).toBe('pay_1');
    expect(r.status).toBe(PaymentStatus.SUCCEEDED);
    expect(r.paymentMethodId).toBe('card_4242');
  });
  it('createPaymentIntent maps a payment without card details', async () => {
    const p = await makeProcessor();
    push(ok({ payment: payment({ card_details: undefined }) }));
    const r = await p.createPaymentIntent({ amount: new Decimal('10'), currency: 'usd' });
    expect(r.paymentMethodId).toBeUndefined();
  });
  it('createPaymentIntent wraps errors (errors[].detail message)', async () => {
    const p = await makeProcessor();
    push(fail({ errors: [{ detail: 'bad source' }] }));
    await expect(p.createPaymentIntent({ amount: new Decimal('1'), currency: 'usd' })).rejects.toThrow(
      'bad source',
    );
  });
  it.each([
    ['APPROVED', PaymentStatus.PROCESSING],
    ['PENDING', PaymentStatus.PENDING],
    ['CANCELED', PaymentStatus.CANCELLED],
    ['FAILED', PaymentStatus.FAILED],
    ['WEIRD', PaymentStatus.PENDING],
  ])('maps payment status %s', async (status, expected) => {
    const p = await makeProcessor();
    push(ok({ payment: payment({ status }) }));
    expect((await p.retrievePaymentIntent('pay_1')).status).toBe(expected);
  });
  it('confirm/cancel map; all wrap errors (statusText fallback)', async () => {
    const p = await makeProcessor();
    push(ok({ payment: payment() }));
    expect((await p.confirmPaymentIntent('pay_1')).id).toBe('pay_1');
    push(ok({ payment: payment({ status: 'CANCELED' }) }));
    expect((await p.cancelPaymentIntent('pay_1')).status).toBe(PaymentStatus.CANCELLED);
    push(fail({ statusText: 'Server Error' }));
    await expect(p.retrievePaymentIntent('pay_1')).rejects.toThrow('Failed to retrieve Square payment');
    push(fail());
    await expect(p.confirmPaymentIntent('pay_1')).rejects.toThrow('Failed to complete Square payment');
    push(fail());
    await expect(p.cancelPaymentIntent('pay_1')).rejects.toThrow('Failed to cancel Square payment');
  });
});

describe('SquareProcessor — refunds', () => {
  it('createRefund retrieves the payment then refunds (amount + reason)', async () => {
    const p = await makeProcessor();
    push(ok({ payment: payment() }), ok({ refund: refundRow() }));
    const r = await p.createRefund({
      paymentIntentId: 'pay_1',
      amount: new Decimal('5'),
      reason: 'duplicate',
    });
    expect(r.id).toBe('rf_1');
    expect(r.status).toBe(PaymentStatus.REFUNDED);
  });
  it('createRefund without amount refunds in full', async () => {
    const p = await makeProcessor();
    push(ok({ payment: payment() }), ok({ refund: refundRow({ status: 'PENDING' }) }));
    const r = await p.createRefund({ paymentIntentId: 'pay_1' });
    expect(r.status).toBe(PaymentStatus.PROCESSING);
  });
  it('createRefund wraps errors', async () => {
    const p = await makeProcessor();
    push(fail());
    await expect(p.createRefund({ paymentIntentId: 'pay_1' })).rejects.toThrow(
      'Failed to create Square refund',
    );
  });
  it.each([
    ['COMPLETED', PaymentStatus.REFUNDED],
    ['REJECTED', PaymentStatus.FAILED],
    ['FAILED', PaymentStatus.FAILED],
    ['WEIRD', PaymentStatus.PROCESSING],
  ])('retrieveRefund maps status %s', async (status, expected) => {
    const p = await makeProcessor();
    push(ok({ refund: refundRow({ status }) }));
    expect((await p.retrieveRefund('rf_1')).status).toBe(expected);
  });
  it('retrieveRefund wraps errors', async () => {
    const p = await makeProcessor();
    push(fail());
    await expect(p.retrieveRefund('rf_1')).rejects.toThrow('Failed to retrieve Square refund');
  });
});

describe('SquareProcessor — customers', () => {
  it('createCustomer with name/phone/address', async () => {
    const p = await makeProcessor();
    push(ok({ customer: customerRow() }));
    const id = await p.createCustomer({
      email: 'a@b.com',
      name: 'Alice Smith',
      phone: '555',
      address: { line1: 'L1', city: 'C', country: 'CA' },
    });
    expect(id).toBe('cus_1');
  });
  it('createCustomer with single-word name', async () => {
    const p = await makeProcessor();
    push(ok({ customer: customerRow() }));
    expect(await p.createCustomer({ email: 'a@b.com', name: 'Cher' })).toBe('cus_1');
  });
  it('createCustomer wraps errors', async () => {
    const p = await makeProcessor();
    push(fail());
    await expect(p.createCustomer({ email: 'a@b.com' })).rejects.toThrow(
      'Failed to create Square customer',
    );
  });
  it('retrieveCustomer maps fields', async () => {
    const p = await makeProcessor();
    push(ok({ customer: customerRow() }));
    const c = await p.retrieveCustomer('cus_1');
    expect(c.name).toBe('Alice Smith');
    expect(c.address?.city).toBe('C');
  });
  it('retrieveCustomer handles missing address/name/email', async () => {
    const p = await makeProcessor();
    push(ok({ customer: customerRow({ address: undefined, given_name: undefined, family_name: undefined, email_address: undefined }) }));
    const c = await p.retrieveCustomer('cus_1');
    expect(c.address).toBeUndefined();
    expect(c.name).toBeUndefined();
    expect(c.email).toBe('');
  });
  it('retrieveCustomer wraps errors', async () => {
    const p = await makeProcessor();
    push(fail());
    await expect(p.retrieveCustomer('cus_1')).rejects.toThrow('Failed to retrieve Square customer');
  });
  it('updateCustomer puts then re-fetches (all fields)', async () => {
    const p = await makeProcessor();
    push(ok({ customer: customerRow() }), ok({ customer: customerRow() }));
    const c = await p.updateCustomer('cus_1', {
      email: 'n@b.com',
      phone: '111',
      name: 'New Name',
      address: { line1: 'L', city: 'C' },
    });
    expect(c.id).toBe('cus_1');
  });
  it('updateCustomer with single-word name', async () => {
    const p = await makeProcessor();
    push(ok({ customer: customerRow() }), ok({ customer: customerRow() }));
    const c = await p.updateCustomer('cus_1', { name: 'Cher' });
    expect(c.id).toBe('cus_1');
  });
  it('updateCustomer wraps errors', async () => {
    const p = await makeProcessor();
    push(fail());
    await expect(p.updateCustomer('cus_1', { email: 'n@b.com' })).rejects.toThrow(
      'Failed to update Square customer',
    );
  });
});

describe('SquareProcessor — payment methods', () => {
  it('attachPaymentMethod maps the card', async () => {
    const p = await makeProcessor();
    push(ok({ card: cardRow() }));
    const pm = await p.attachPaymentMethod('src_1', 'cus_1');
    expect(pm.type).toBe(PaymentMethodType.CREDIT_CARD);
    expect(pm.last4).toBe('4242');
    expect(pm.expiryMonth).toBe(12);
  });
  it('attachPaymentMethod wraps errors', async () => {
    const p = await makeProcessor();
    push(fail());
    await expect(p.attachPaymentMethod('src_1', 'cus_1')).rejects.toThrow('Failed to attach Square card');
  });
  it('detachPaymentMethod disables the card', async () => {
    const p = await makeProcessor();
    push(ok({ card: cardRow() }));
    expect((await p.detachPaymentMethod('card_1')).id).toBe('card_1');
  });
  it('detachPaymentMethod wraps errors', async () => {
    const p = await makeProcessor();
    push(fail());
    await expect(p.detachPaymentMethod('card_1')).rejects.toThrow('Failed to detach Square card');
  });
  it('listPaymentMethods maps cards (and empty)', async () => {
    const p = await makeProcessor();
    push(ok({ cards: [cardRow(), cardRow({ id: 'card_2' })] }));
    expect(await p.listPaymentMethods('cus_1')).toHaveLength(2);
    push(ok({}));
    expect(await p.listPaymentMethods('cus_1')).toHaveLength(0);
  });
  it('listPaymentMethods wraps errors', async () => {
    const p = await makeProcessor();
    push(fail());
    await expect(p.listPaymentMethods('cus_1')).rejects.toThrow('Failed to list Square cards');
  });
});

describe('SquareProcessor — webhooks', () => {
  const SECRET = 'whsecret';
  const sign = (payload: string) => createHmac('sha256', SECRET).update(payload).digest('base64');
  const webhookPayload = (type: string) =>
    JSON.stringify({
      event_id: 'evt_1',
      type,
      data: { id: 'res_1' },
      created_at: '2024-01-01T00:00:00Z',
    });

  it('verifyWebhook returns verified:false when no signature key configured', async () => {
    const p = await makeProcessor();
    const res = await p.verifyWebhook('{}', 'sig');
    expect(res.verified).toBe(false);
    expect(res.error).toContain('signature key');
  });
  it('verifyWebhook returns a mapped event on a valid signature (known + unknown types)', async () => {
    const p = await makeProcessor({ webhookSecret: SECRET });
    const known = webhookPayload('payment.created');
    const r1 = await p.verifyWebhook(known, sign(known));
    expect(r1.verified).toBe(true);
    expect(r1.event?.type).toBe(WebhookEventType.PAYMENT_SUCCEEDED);

    const unknown = webhookPayload('something.else');
    const r2 = await p.verifyWebhook(unknown, sign(unknown));
    expect(r2.event?.type).toBe(WebhookEventType.PAYMENT_SUCCEEDED);
  });
  it('verifyWebhook returns verified:false when the signature mismatches', async () => {
    const p = await makeProcessor({ webhookSecret: SECRET });
    const res = await p.verifyWebhook(webhookPayload('payment.created'), 'wrong-sig');
    expect(res.verified).toBe(false);
    expect(res.error).toContain('verification failed');
  });
  it('verifyWebhook returns verified:false on invalid JSON with a valid signature', async () => {
    const p = await makeProcessor({ webhookSecret: SECRET });
    const res = await p.verifyWebhook('not-json', sign('not-json'));
    expect(res.verified).toBe(false);
    expect(res.error).toBeDefined();
  });
  it('processWebhook is inert', async () => {
    const p = await makeProcessor();
    await expect(
      p.processWebhook({ id: 'e', type: WebhookEventType.PAYMENT_SUCCEEDED } as never),
    ).resolves.toBeUndefined();
  });
});
