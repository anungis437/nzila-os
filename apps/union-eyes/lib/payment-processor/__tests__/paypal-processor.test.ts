/**
 * PayPal Payment Processor — Unit Tests
 *
 * PayPal talks to its REST API exclusively through global fetch (token exchange
 * + paypalRequest). We drive a queue-based fetch mock: each fetch shifts the
 * next queued Response-like object. After initialize() consumes one token
 * fetch, the OAuth token is cached, so each subsequent operation consumes
 * exactly one (or two) endpoint fetches. decimal.js stays real.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Decimal } from 'decimal.js';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { PayPalProcessor } from '../processors/paypal-processor';
import { PaymentStatus, WebhookEventType, PaymentMethodType } from '../types';

let fetchQueue: Array<Record<string, unknown>>;
const realFetch = global.fetch;

function ok(data: unknown) {
  return {
    ok: true,
    statusText: 'OK',
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}
function fail(statusText = 'Bad Request') {
  return {
    ok: false,
    statusText,
    json: async () => ({}),
    text: async () => 'error body',
  };
}
function push(...responses: Record<string, unknown>[]) {
  fetchQueue.push(...responses);
}

async function makeProcessor(opts: { env?: 'test' | 'production'; webhookSecret?: string } = {}) {
  push(ok({ access_token: 'tok', expires_in: 3600 })); // token fetch during init
  const p = new PayPalProcessor();
  await p.initialize({
    apiKey: 'client-id-1234',
    environment: opts.env ?? 'test',
    webhookSecret: opts.webhookSecret,
    metadata: { clientSecret: 'secret' },
  });
  return p;
}

const order = (over: Record<string, unknown> = {}) => ({
  id: 'order_1',
  status: 'COMPLETED',
  purchase_units: [
    {
      amount: { currency_code: 'USD', value: '10.00' },
      payments: {
        captures: [{ id: 'cap_1', status: 'COMPLETED', amount: { currency_code: 'USD', value: '10.00' } }],
      },
    },
  ],
  payer: { email_address: 'a@b.com', name: { given_name: 'A', surname: 'B' } },
  create_time: '2024-01-01T00:00:00Z',
  ...over,
});

const refundRow = (over: Record<string, unknown> = {}) => ({
  id: 'rf_1',
  status: 'COMPLETED',
  amount: { currency_code: 'USD', value: '5.00' },
  create_time: '2024-01-01T00:00:00Z',
  ...over,
});

const vaultCustomer = (over: Record<string, unknown> = {}) => ({
  id: 'cus_1',
  email_address: 'a@b.com',
  name: { given_name: 'A', surname: 'B' },
  phone: { phone_number: { national_number: '555' } },
  address: {
    address_line_1: 'L1',
    address_line_2: 'L2',
    admin_area_2: 'C',
    admin_area_1: 'S',
    postal_code: 'P',
    country_code: 'CA',
  },
  ...over,
});

const cardToken = (over: Record<string, unknown> = {}) => ({
  id: 'pm_1',
  customer_id: 'cus_1',
  payment_source: { card: { brand: 'VISA', last_digits: '4242', expiry: '2030-12' } },
  create_time: '2024-01-01T00:00:00Z',
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

describe('PayPalProcessor — initialize / auth', () => {
  it('initializes (sandbox) and caches the OAuth token', async () => {
    const p = await makeProcessor();
    expect(p.type).toBe('paypal');
  });
  it('initializes in production environment', async () => {
    const p = await makeProcessor({ env: 'production' });
    push(ok(order()));
    expect((await p.retrievePaymentIntent('order_1')).id).toBe('order_1');
  });
  it('throws when clientSecret missing', async () => {
    const p = new PayPalProcessor();
    await expect(
      p.initialize({ apiKey: 'cid', environment: 'test', metadata: {} }),
    ).rejects.toThrow('client secret');
  });
  it('rejects initialize when the token fetch fails', async () => {
    push(fail('Unauthorized'));
    const p = new PayPalProcessor();
    await expect(
      p.initialize({ apiKey: 'cid', environment: 'test', metadata: { clientSecret: 's' } }),
    ).rejects.toThrow('Failed to obtain PayPal access token');
  });
});

describe('PayPalProcessor — payment intents', () => {
  it('createPaymentIntent maps the order (with metadata)', async () => {
    const p = await makeProcessor();
    push(ok(order()));
    const r = await p.createPaymentIntent({
      amount: new Decimal('10.00'),
      currency: 'usd',
      description: 'desc',
      metadata: { customId: 'c1', returnUrl: 'r', cancelUrl: 'x' },
    });
    expect(r.id).toBe('order_1');
    expect(r.status).toBe(PaymentStatus.SUCCEEDED);
    expect(r.currency).toBe('usd');
  });
  it.each([
    ['CREATED', PaymentStatus.PENDING],
    ['APPROVED', PaymentStatus.PROCESSING],
    ['VOIDED', PaymentStatus.CANCELLED],
    ['UNKNOWN', PaymentStatus.PENDING],
  ])('maps order status %s', async (status, expected) => {
    const p = await makeProcessor();
    push(ok(order({ status })));
    expect((await p.retrievePaymentIntent('order_1')).status).toBe(expected);
  });
  it('createPaymentIntent wraps errors', async () => {
    const p = await makeProcessor();
    push(fail());
    await expect(p.createPaymentIntent({ amount: new Decimal('1'), currency: 'usd' })).rejects.toThrow(
      'Failed to create PayPal order',
    );
  });
  it('retrieve/confirm map; both wrap errors', async () => {
    const p = await makeProcessor();
    push(ok(order()));
    expect((await p.retrievePaymentIntent('order_1')).id).toBe('order_1');
    push(ok(order({ status: 'COMPLETED' })));
    expect((await p.confirmPaymentIntent('order_1')).status).toBe(PaymentStatus.SUCCEEDED);
    push(fail());
    await expect(p.retrievePaymentIntent('order_1')).rejects.toThrow('Failed to retrieve PayPal order');
    push(fail());
    await expect(p.confirmPaymentIntent('order_1')).rejects.toThrow('Failed to capture PayPal order');
  });
  it('cancelPaymentIntent returns the current order; wraps errors', async () => {
    const p = await makeProcessor();
    push(ok(order()));
    expect((await p.cancelPaymentIntent('order_1')).id).toBe('order_1');
    push(fail());
    await expect(p.cancelPaymentIntent('order_1')).rejects.toThrow('Failed to cancel PayPal order');
  });
});

describe('PayPalProcessor — refunds', () => {
  it('createRefund with amount + reason captures and refunds', async () => {
    const p = await makeProcessor();
    push(ok(order()), ok(refundRow()));
    const r = await p.createRefund({
      paymentIntentId: 'order_1',
      amount: new Decimal('5'),
      reason: 'duplicate',
    });
    expect(r.id).toBe('rf_1');
    expect(r.status).toBe(PaymentStatus.REFUNDED);
  });
  it('createRefund without amount refunds in full', async () => {
    const p = await makeProcessor();
    push(ok(order()), ok(refundRow({ status: 'PENDING' })));
    const r = await p.createRefund({ paymentIntentId: 'order_1' });
    expect(r.status).toBe(PaymentStatus.PROCESSING);
  });
  it('createRefund throws when no capture exists', async () => {
    const p = await makeProcessor();
    push(ok(order({ purchase_units: [{ amount: { currency_code: 'USD', value: '10.00' } }] })));
    await expect(p.createRefund({ paymentIntentId: 'order_1' })).rejects.toThrow(
      'Failed to create PayPal refund',
    );
  });
  it('createRefund wraps fetch errors', async () => {
    const p = await makeProcessor();
    push(fail());
    await expect(p.createRefund({ paymentIntentId: 'order_1' })).rejects.toThrow(
      'Failed to create PayPal refund',
    );
  });
  it.each([
    ['FAILED', PaymentStatus.FAILED],
    ['CANCELLED', PaymentStatus.CANCELLED],
    ['WEIRD', PaymentStatus.PROCESSING],
  ])('retrieveRefund maps status %s', async (status, expected) => {
    const p = await makeProcessor();
    push(ok(refundRow({ status })));
    expect((await p.retrieveRefund('rf_1')).status).toBe(expected);
  });
  it('retrieveRefund wraps errors', async () => {
    const p = await makeProcessor();
    push(fail());
    await expect(p.retrieveRefund('rf_1')).rejects.toThrow('Failed to retrieve PayPal refund');
  });
});

describe('PayPalProcessor — customers', () => {
  it('createCustomer with name/phone/address', async () => {
    const p = await makeProcessor();
    push(ok(vaultCustomer()));
    const id = await p.createCustomer({
      email: 'a@b.com',
      name: 'Alice Smith',
      phone: '555',
      address: { line1: 'L1', city: 'C', postalCode: 'P', country: 'CA' },
    });
    expect(id).toBe('cus_1');
  });
  it('createCustomer wraps errors', async () => {
    const p = await makeProcessor();
    push(fail());
    await expect(p.createCustomer({ email: 'a@b.com' })).rejects.toThrow(
      'Failed to create PayPal customer',
    );
  });
  it('retrieveCustomer maps name/phone/address', async () => {
    const p = await makeProcessor();
    push(ok(vaultCustomer()));
    const c = await p.retrieveCustomer('cus_1');
    expect(c.name).toBe('A B');
    expect(c.address?.city).toBe('C');
  });
  it('retrieveCustomer handles missing address/name', async () => {
    const p = await makeProcessor();
    push(ok(vaultCustomer({ address: undefined, name: undefined, email_address: undefined, phone: undefined })));
    const c = await p.retrieveCustomer('cus_1');
    expect(c.address).toBeUndefined();
    expect(c.email).toBe('');
  });
  it('retrieveCustomer wraps errors', async () => {
    const p = await makeProcessor();
    push(fail());
    await expect(p.retrieveCustomer('cus_1')).rejects.toThrow('Failed to retrieve PayPal customer');
  });
  it('updateCustomer patches then re-fetches', async () => {
    const p = await makeProcessor();
    push(ok({}), ok(vaultCustomer()));
    const c = await p.updateCustomer('cus_1', {
      email: 'n@b.com',
      name: 'New Name',
      phone: '111',
      address: { line1: 'L', city: 'C' },
    });
    expect(c.id).toBe('cus_1');
  });
  it('updateCustomer with no fields only re-fetches', async () => {
    const p = await makeProcessor();
    push(ok(vaultCustomer()));
    const c = await p.updateCustomer('cus_1', {});
    expect(c.id).toBe('cus_1');
  });
  it('updateCustomer wraps errors', async () => {
    const p = await makeProcessor();
    push(fail());
    await expect(p.updateCustomer('cus_1', { email: 'n@b.com' })).rejects.toThrow(
      'Failed to update PayPal customer',
    );
  });
});

describe('PayPalProcessor — payment methods', () => {
  it('attachPaymentMethod maps a card token', async () => {
    const p = await makeProcessor();
    push(ok(cardToken()));
    const pm = await p.attachPaymentMethod('pm_1', 'cus_1');
    expect(pm.type).toBe(PaymentMethodType.CREDIT_CARD);
    expect(pm.last4).toBe('4242');
    expect(pm.expiryMonth).toBe(12);
    expect(pm.expiryYear).toBe(2030);
  });
  it('attachPaymentMethod wraps errors', async () => {
    const p = await makeProcessor();
    push(fail());
    await expect(p.attachPaymentMethod('pm_1', 'cus_1')).rejects.toThrow(
      'Failed to attach PayPal payment method',
    );
  });
  it('detachPaymentMethod fetches then deletes (paypal-source token)', async () => {
    const p = await makeProcessor();
    push(
      ok({ id: 'pm_2', customer_id: 'cus_1', payment_source: { paypal: { email_address: 'a@b.com' } } }),
      ok({}),
    );
    const pm = await p.detachPaymentMethod('pm_2');
    expect(pm.type).toBe(PaymentMethodType.PAYPAL);
    expect(pm.last4).toBeUndefined();
  });
  it('detachPaymentMethod wraps errors', async () => {
    const p = await makeProcessor();
    push(fail());
    await expect(p.detachPaymentMethod('pm_2')).rejects.toThrow(
      'Failed to detach PayPal payment method',
    );
  });
  it('listPaymentMethods reads payment_tokens then items fallback', async () => {
    const p = await makeProcessor();
    push(ok({ payment_tokens: [cardToken()] }));
    expect(await p.listPaymentMethods('cus_1')).toHaveLength(1);
    push(ok({ items: [cardToken(), cardToken({ id: 'pm_x' })] }));
    expect(await p.listPaymentMethods('cus_1')).toHaveLength(2);
    push(ok({}));
    expect(await p.listPaymentMethods('cus_1')).toHaveLength(0);
  });
  it('listPaymentMethods wraps errors', async () => {
    const p = await makeProcessor();
    push(fail());
    await expect(p.listPaymentMethods('cus_1')).rejects.toThrow(
      'Failed to list PayPal payment methods',
    );
  });
});

describe('PayPalProcessor — webhooks', () => {
  const webhookPayload = (eventType: string) =>
    JSON.stringify({
      id: 'evt_1',
      event_type: eventType,
      resource: { id: 'res_1' },
      create_time: '2024-01-01T00:00:00Z',
      cert_url: 'https://c',
      transmission_id: 't1',
      transmission_time: '2024-01-01T00:00:00Z',
    });

  it('verifyWebhook returns verified:false when no webhook id configured', async () => {
    const p = await makeProcessor();
    const res = await p.verifyWebhook('{}', 'algo=sig');
    expect(res.verified).toBe(false);
    expect(res.error).toContain('webhook ID');
  });
  it('verifyWebhook returns a mapped event on SUCCESS (known + unknown types)', async () => {
    const p = await makeProcessor({ webhookSecret: 'whid' });
    push(ok({ verification_status: 'SUCCESS' }));
    const known = await p.verifyWebhook(webhookPayload('PAYMENT.CAPTURE.COMPLETED'), 'algo=sig');
    expect(known.verified).toBe(true);
    expect(known.event?.type).toBe(WebhookEventType.PAYMENT_SUCCEEDED);

    push(ok({ verification_status: 'SUCCESS' }));
    const unknown = await p.verifyWebhook(webhookPayload('SOMETHING.ELSE'), 'algo=sig');
    expect(unknown.event?.type).toBe(WebhookEventType.PAYMENT_SUCCEEDED);
  });
  it('verifyWebhook returns verified:false when verification_status is not SUCCESS', async () => {
    const p = await makeProcessor({ webhookSecret: 'whid' });
    push(ok({ verification_status: 'FAILURE' }));
    const res = await p.verifyWebhook(webhookPayload('PAYMENT.CAPTURE.COMPLETED'), 'algo=sig');
    expect(res.verified).toBe(false);
    expect(res.event).toBeUndefined();
  });
  it('verifyWebhook returns verified:false on invalid JSON', async () => {
    const p = await makeProcessor({ webhookSecret: 'whid' });
    const res = await p.verifyWebhook('not-json', 'algo=sig');
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
