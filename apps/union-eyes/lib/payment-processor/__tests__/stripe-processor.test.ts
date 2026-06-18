/**
 * Stripe Payment Processor — Unit Tests
 *
 * '@nzila/payments-stripe' getStripeClient is mocked to return a fully-faked
 * Stripe client (all methods are vi.fn() configured per test). '@/lib/stripe'
 * is a type-only import (no runtime). decimal.js stays real.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Decimal } from 'decimal.js';

const mocks = vi.hoisted(() => {
  const stripe = {
    paymentIntents: {
      create: vi.fn(),
      retrieve: vi.fn(),
      confirm: vi.fn(),
      cancel: vi.fn(),
    },
    refunds: { create: vi.fn(), retrieve: vi.fn() },
    customers: { create: vi.fn(), retrieve: vi.fn(), update: vi.fn() },
    paymentMethods: { attach: vi.fn(), detach: vi.fn(), list: vi.fn() },
    webhooks: { constructEvent: vi.fn() },
  };
  return { stripe };
});

vi.mock('@nzila/payments-stripe', () => ({
  getStripeClient: () => mocks.stripe,
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { StripeProcessor } from '../processors/stripe-processor';
import { PaymentStatus, WebhookEventType, PaymentMethodType } from '../types';

function makeProcessor(webhookSecret?: string) {
  const p = new StripeProcessor();
  return p
    .initialize({ apiKey: 'sk_test', webhookSecret, environment: 'test' })
    .then(() => p);
}

const piRow = (over: Record<string, unknown> = {}) => ({
  id: 'pi_1',
  amount: 1050,
  currency: 'usd',
  status: 'succeeded',
  payment_method: 'pm_1',
  customer: 'cus_1',
  metadata: { k: 'v' },
  created: 1_700_000_000,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('StripeProcessor — payment intents', () => {
  it('createPaymentIntent passes through all optional fields', async () => {
    const p = await makeProcessor();
    mocks.stripe.paymentIntents.create.mockResolvedValue(piRow());
    const result = await p.createPaymentIntent({
      amount: new Decimal('10.50'),
      currency: 'USD',
      customerId: 'cus_1',
      paymentMethodId: 'pm_1',
      confirm: true,
      setupFutureUsage: 'off_session',
      description: 'desc',
      receiptEmail: 'a@b.com',
      metadata: { s: 'x', n: 5, b: true, nul: null, obj: { a: 1 } },
    });
    expect(result.id).toBe('pi_1');
    expect(result.status).toBe(PaymentStatus.SUCCEEDED);
    expect(result.amount.toNumber()).toBe(10.5);
    const params = mocks.stripe.paymentIntents.create.mock.calls[0][0];
    expect(params.confirm).toBe(true);
    expect(params.metadata.b).toBe('true');
    expect(params.metadata.obj).toBe('{"a":1}');
  });

  it('createPaymentIntent maps non-string payment_method/customer to undefined', async () => {
    const p = await makeProcessor();
    mocks.stripe.paymentIntents.create.mockResolvedValue(
      piRow({ payment_method: { id: 'x' }, customer: { id: 'y' }, status: 'requires_payment_method' }),
    );
    const r = await p.createPaymentIntent({ amount: new Decimal('1'), currency: 'usd' });
    expect(r.paymentMethodId).toBeUndefined();
    expect(r.customerId).toBeUndefined();
    expect(r.status).toBe(PaymentStatus.PENDING);
  });

  it('createPaymentIntent before initialize throws (ensureInitialized)', async () => {
    const p = new StripeProcessor();
    await expect(p.createPaymentIntent({ amount: new Decimal('1'), currency: 'usd' })).rejects.toThrow(
      'Failed to create payment intent',
    );
  });

  it('createPaymentIntent wraps stripe errors', async () => {
    const p = await makeProcessor();
    mocks.stripe.paymentIntents.create.mockRejectedValue(new Error('stripe down'));
    await expect(p.createPaymentIntent({ amount: new Decimal('1'), currency: 'usd' })).rejects.toThrow(
      'Failed to create payment intent',
    );
  });

  it('retrieve/confirm/cancel map the intent', async () => {
    const p = await makeProcessor();
    mocks.stripe.paymentIntents.retrieve.mockResolvedValue(piRow());
    mocks.stripe.paymentIntents.confirm.mockResolvedValue(piRow({ status: 'processing' }));
    mocks.stripe.paymentIntents.cancel.mockResolvedValue(piRow({ status: 'canceled' }));
    expect((await p.retrievePaymentIntent('pi_1')).id).toBe('pi_1');
    expect((await p.confirmPaymentIntent('pi_1')).status).toBe(PaymentStatus.PROCESSING);
    expect((await p.cancelPaymentIntent('pi_1')).status).toBe(PaymentStatus.CANCELLED);
  });

  it('retrieve/confirm/cancel wrap errors', async () => {
    const p = await makeProcessor();
    mocks.stripe.paymentIntents.retrieve.mockRejectedValue(new Error('x'));
    mocks.stripe.paymentIntents.confirm.mockRejectedValue(new Error('x'));
    mocks.stripe.paymentIntents.cancel.mockRejectedValue(new Error('x'));
    await expect(p.retrievePaymentIntent('pi_1')).rejects.toThrow('Failed to retrieve payment intent');
    await expect(p.confirmPaymentIntent('pi_1')).rejects.toThrow('Failed to confirm payment intent');
    await expect(p.cancelPaymentIntent('pi_1')).rejects.toThrow('Failed to cancel payment intent');
  });
});

describe('StripeProcessor — refunds', () => {
  const refundRow = (over: Record<string, unknown> = {}) => ({
    id: 'rf_1',
    amount: 500,
    currency: 'usd',
    status: 'succeeded',
    payment_intent: 'pi_1',
    created: 1_700_000_000,
    ...over,
  });

  it('createRefund with amount + reason fetches currency from the intent', async () => {
    const p = await makeProcessor();
    mocks.stripe.paymentIntents.retrieve.mockResolvedValue(piRow());
    mocks.stripe.refunds.create.mockResolvedValue(refundRow());
    const r = await p.createRefund({
      paymentIntentId: 'pi_1',
      amount: new Decimal('5'),
      reason: 'requested_by_customer',
      metadata: { a: 1 },
    });
    expect(r.id).toBe('rf_1');
    expect(r.status).toBe(PaymentStatus.SUCCEEDED);
    expect(mocks.stripe.paymentIntents.retrieve).toHaveBeenCalled();
  });

  it('createRefund without amount skips the intent lookup', async () => {
    const p = await makeProcessor();
    mocks.stripe.refunds.create.mockResolvedValue(refundRow({ status: null }));
    const r = await p.createRefund({ paymentIntentId: 'pi_1' });
    expect(r.amount.toNumber()).toBe(5);
    expect(mocks.stripe.paymentIntents.retrieve).not.toHaveBeenCalled();
  });

  it('createRefund wraps errors', async () => {
    const p = await makeProcessor();
    mocks.stripe.refunds.create.mockRejectedValue(new Error('x'));
    await expect(p.createRefund({ paymentIntentId: 'pi_1' })).rejects.toThrow('Failed to create refund');
  });

  it('retrieveRefund maps string and non-string payment_intent', async () => {
    const p = await makeProcessor();
    mocks.stripe.refunds.retrieve.mockResolvedValueOnce(refundRow());
    expect((await p.retrieveRefund('rf_1')).paymentIntentId).toBe('pi_1');
    mocks.stripe.refunds.retrieve.mockResolvedValueOnce(refundRow({ payment_intent: { id: 'pi' }, status: null }));
    expect((await p.retrieveRefund('rf_1')).paymentIntentId).toBe('');
  });

  it('retrieveRefund wraps errors', async () => {
    const p = await makeProcessor();
    mocks.stripe.refunds.retrieve.mockRejectedValue(new Error('x'));
    await expect(p.retrieveRefund('rf_1')).rejects.toThrow('Failed to retrieve refund');
  });
});

describe('StripeProcessor — customers', () => {
  const custRow = (over: Record<string, unknown> = {}) => ({
    id: 'cus_1',
    email: 'a@b.com',
    name: 'Alice',
    phone: '555',
    deleted: false,
    address: {
      line1: 'L1',
      line2: 'L2',
      city: 'C',
      state: 'S',
      postal_code: 'P',
      country: 'CA',
    },
    metadata: { k: 'v' },
    ...over,
  });

  it('createCustomer with name/phone/address/metadata', async () => {
    const p = await makeProcessor();
    mocks.stripe.customers.create.mockResolvedValue(custRow());
    const id = await p.createCustomer({
      email: 'a@b.com',
      name: 'Alice',
      phone: '555',
      address: { line1: 'L1', city: 'C', postalCode: 'P', country: 'CA' },
      metadata: { k: 'v' },
    });
    expect(id).toBe('cus_1');
  });
  it('createCustomer wraps errors', async () => {
    const p = await makeProcessor();
    mocks.stripe.customers.create.mockRejectedValue(new Error('x'));
    await expect(p.createCustomer({ email: 'a@b.com' })).rejects.toThrow('Failed to create customer');
  });

  it('retrieveCustomer maps address and metadata', async () => {
    const p = await makeProcessor();
    mocks.stripe.customers.retrieve.mockResolvedValue(custRow());
    const c = await p.retrieveCustomer('cus_1');
    expect(c.email).toBe('a@b.com');
    expect(c.address?.postalCode).toBe('P');
  });
  it('retrieveCustomer throws when the customer is deleted', async () => {
    const p = await makeProcessor();
    mocks.stripe.customers.retrieve.mockResolvedValue({ id: 'cus_1', deleted: true });
    await expect(p.retrieveCustomer('cus_1')).rejects.toThrow('Failed to retrieve customer');
  });
  it('retrieveCustomer handles a customer with no address', async () => {
    const p = await makeProcessor();
    mocks.stripe.customers.retrieve.mockResolvedValue(
      custRow({ address: null, name: null, phone: null, email: null }),
    );
    const c = await p.retrieveCustomer('cus_1');
    expect(c.address).toBeUndefined();
    expect(c.email).toBe('');
  });

  it('updateCustomer applies fields and re-fetches', async () => {
    const p = await makeProcessor();
    mocks.stripe.customers.update.mockResolvedValue(custRow());
    mocks.stripe.customers.retrieve.mockResolvedValue(custRow());
    const c = await p.updateCustomer('cus_1', {
      email: 'n@b.com',
      name: 'N',
      phone: '111',
      metadata: { x: 1 },
      address: { line1: 'L', city: 'C' },
    });
    expect(c.id).toBe('cus_1');
  });
  it('updateCustomer wraps errors', async () => {
    const p = await makeProcessor();
    mocks.stripe.customers.update.mockRejectedValue(new Error('x'));
    await expect(p.updateCustomer('cus_1', { name: 'N' })).rejects.toThrow('Failed to update customer');
  });
});

describe('StripeProcessor — payment methods', () => {
  const cardPm = (over: Record<string, unknown> = {}) => ({
    id: 'pm_1',
    type: 'card',
    card: { last4: '4242', brand: 'visa', exp_month: 12, exp_year: 2030 },
    customer: 'cus_1',
    created: 1_700_000_000,
    ...over,
  });

  it('attachPaymentMethod maps a card method', async () => {
    const p = await makeProcessor();
    mocks.stripe.paymentMethods.attach.mockResolvedValue(cardPm());
    const pm = await p.attachPaymentMethod('pm_1', 'cus_1');
    expect(pm.type).toBe(PaymentMethodType.CREDIT_CARD);
    expect(pm.last4).toBe('4242');
  });
  it('detachPaymentMethod maps a us_bank_account method', async () => {
    const p = await makeProcessor();
    mocks.stripe.paymentMethods.detach.mockResolvedValue({
      id: 'pm_2',
      type: 'us_bank_account',
      us_bank_account: { last4: '6789' },
      customer: { id: 'obj' },
      created: 1_700_000_000,
    });
    const pm = await p.detachPaymentMethod('pm_2');
    expect(pm.type).toBe(PaymentMethodType.ACH);
    expect(pm.last4).toBe('6789');
    expect(pm.customerId).toBeUndefined();
  });
  it('listPaymentMethods maps the collection (incl. unknown type)', async () => {
    const p = await makeProcessor();
    mocks.stripe.paymentMethods.list.mockResolvedValue({
      data: [cardPm(), { id: 'pm_3', type: 'sepa_debit', created: 1_700_000_000 }],
    });
    const list = await p.listPaymentMethods('cus_1');
    expect(list).toHaveLength(2);
    expect(list[1].type).toBe(PaymentMethodType.CREDIT_CARD);
    expect(list[1].last4).toBeUndefined();
  });
  it('payment method ops wrap errors', async () => {
    const p = await makeProcessor();
    mocks.stripe.paymentMethods.attach.mockRejectedValue(new Error('x'));
    mocks.stripe.paymentMethods.detach.mockRejectedValue(new Error('x'));
    mocks.stripe.paymentMethods.list.mockRejectedValue(new Error('x'));
    await expect(p.attachPaymentMethod('pm', 'cus')).rejects.toThrow('Failed to attach payment method');
    await expect(p.detachPaymentMethod('pm')).rejects.toThrow('Failed to detach payment method');
    await expect(p.listPaymentMethods('cus')).rejects.toThrow('Failed to list payment methods');
  });
});

describe('StripeProcessor — webhooks', () => {
  it('verifyWebhook returns verified:false when no secret configured', async () => {
    const p = await makeProcessor();
    const res = await p.verifyWebhook('{}', 'sig');
    expect(res.verified).toBe(false);
    expect(res.error).toContain('Webhook secret');
  });

  it('verifyWebhook maps known and unknown stripe events', async () => {
    const p = await makeProcessor('whsec_test');
    mocks.stripe.webhooks.constructEvent.mockReturnValue({
      id: 'evt_1',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_1' } },
      created: 1_700_000_000,
    });
    const known = await p.verifyWebhook('payload', 'sig');
    expect(known.verified).toBe(true);
    expect(known.event?.type).toBe(WebhookEventType.PAYMENT_SUCCEEDED);

    mocks.stripe.webhooks.constructEvent.mockReturnValue({
      id: 'evt_2',
      type: 'some.unknown.event',
      data: { object: {} },
      created: 1_700_000_000,
    });
    const unknown = await p.verifyWebhook('payload', 'sig');
    expect(unknown.event?.type).toBe(WebhookEventType.PAYMENT_SUCCEEDED);
  });

  it('verifyWebhook returns verified:false when constructEvent throws', async () => {
    const p = await makeProcessor('whsec_test');
    mocks.stripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('bad signature');
    });
    const res = await p.verifyWebhook('payload', 'sig');
    expect(res.verified).toBe(false);
    expect(res.error).toBe('bad signature');
  });

  it('processWebhook is inert', async () => {
    const p = await makeProcessor('whsec_test');
    await expect(
      p.processWebhook({ id: 'e', type: WebhookEventType.PAYMENT_SUCCEEDED } as never),
    ).resolves.toBeUndefined();
  });
});
