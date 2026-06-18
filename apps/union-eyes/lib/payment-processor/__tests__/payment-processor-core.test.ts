/**
 * Payment Processor — Core Unit Tests
 *
 * Covers the SDK-free surface of the payment-processor module:
 *  - types.ts          error classes
 *  - base-processor.ts mapProcessorStatus + inherited helpers + abstract guard
 *  - future-processors.ts (ManualProcessor)
 *  - whop-processor.ts (no external SDK)
 *  - processor-factory.ts (full lifecycle; SDK processors initialized via mocks)
 *
 * External coupling is mocked: '@nzila/payments-stripe' getStripeClient and the
 * global fetch used by PayPal's token exchange. drizzle/decimal stay real.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Decimal } from 'decimal.js';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@nzila/payments-stripe', () => ({
  getStripeClient: () => ({ __fake: 'stripe' }),
}));

import {
  PaymentProcessorType,
  PaymentStatus,
  WebhookEventType,
  PaymentProcessorError,
  PaymentIntentError,
  RefundError,
  WebhookVerificationError,
  CustomerError,
  type ProcessorConfig,
  type CreatePaymentIntentOptions,
  type PaymentIntent,
  type RefundRequest,
  type RefundResult,
  type CustomerInfo,
  type PaymentMethod,
  type WebhookVerification,
  type WebhookEvent,
} from '../types';
import { BasePaymentProcessor, mapProcessorStatus } from '../processors/base-processor';
import { ManualProcessor } from '../processors/future-processors';
import { WhopProcessor } from '../processors/whop-processor';
import {
  PaymentProcessorFactory,
  loadProcessorConfigFromEnv,
  initializePaymentProcessors,
  type ProcessorFactoryConfig,
} from '../processor-factory';

// Concrete subclass to exercise the abstract base helpers directly.
class TestProcessor extends BasePaymentProcessor {
  constructor() {
    super(PaymentProcessorType.MANUAL, {
      supportsRecurringPayments: false,
      supportsRefunds: false,
      supportsPartialRefunds: false,
      supportsCustomers: false,
      supportsPaymentMethods: false,
      supportsWebhooks: false,
      supportedCurrencies: ['usd'],
      supportedPaymentMethods: [],
    });
  }
  callEnsure() {
    this.ensureInitialized();
  }
  callLogOperation() {
    this.logOperation('op', { a: 1 });
  }
  callLogError() {
    this.logError('op', new Error('boom'), { a: 1 });
  }
  async createPaymentIntent(_o: CreatePaymentIntentOptions): Promise<PaymentIntent> {
    throw new Error('ni');
  }
  async retrievePaymentIntent(_id: string): Promise<PaymentIntent> {
    throw new Error('ni');
  }
  async confirmPaymentIntent(_id: string): Promise<PaymentIntent> {
    throw new Error('ni');
  }
  async cancelPaymentIntent(_id: string): Promise<PaymentIntent> {
    throw new Error('ni');
  }
  async createRefund(_r: RefundRequest): Promise<RefundResult> {
    throw new Error('ni');
  }
  async retrieveRefund(_id: string): Promise<RefundResult> {
    throw new Error('ni');
  }
  async createCustomer(_c: CustomerInfo): Promise<string> {
    throw new Error('ni');
  }
  async retrieveCustomer(_id: string): Promise<CustomerInfo> {
    throw new Error('ni');
  }
  async updateCustomer(_id: string, _u: Partial<CustomerInfo>): Promise<CustomerInfo> {
    throw new Error('ni');
  }
  async attachPaymentMethod(_m: string, _c: string): Promise<PaymentMethod> {
    throw new Error('ni');
  }
  async detachPaymentMethod(_m: string): Promise<PaymentMethod> {
    throw new Error('ni');
  }
  async listPaymentMethods(_c: string): Promise<PaymentMethod[]> {
    throw new Error('ni');
  }
  async verifyWebhook(_p: string, _s: string): Promise<WebhookVerification> {
    throw new Error('ni');
  }
  async processWebhook(_e: WebhookEvent): Promise<void> {
    throw new Error('ni');
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  // Reset the factory singleton between tests.
  (PaymentProcessorFactory as unknown as { instance?: unknown }).instance = undefined;
});

describe('types — error classes', () => {
  it('PaymentProcessorError carries processor/code/details', () => {
    const e = new PaymentProcessorError('msg', PaymentProcessorType.STRIPE, 'CODE', { x: 1 });
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('PaymentProcessorError');
    expect(e.processor).toBe(PaymentProcessorType.STRIPE);
    expect(e.code).toBe('CODE');
    expect(e.details).toEqual({ x: 1 });
  });
  it('subclasses set their own name + fixed code', () => {
    const pi = new PaymentIntentError('a', PaymentProcessorType.WHOP, { d: 1 });
    expect(pi.name).toBe('PaymentIntentError');
    expect(pi.code).toBe('PAYMENT_INTENT_ERROR');
    expect(pi).toBeInstanceOf(PaymentProcessorError);

    const rf = new RefundError('a', PaymentProcessorType.PAYPAL);
    expect(rf.name).toBe('RefundError');
    expect(rf.code).toBe('REFUND_ERROR');

    const wv = new WebhookVerificationError('a', PaymentProcessorType.SQUARE);
    expect(wv.name).toBe('WebhookVerificationError');
    expect(wv.code).toBe('WEBHOOK_VERIFICATION_ERROR');

    const cu = new CustomerError('a', PaymentProcessorType.MANUAL);
    expect(cu.name).toBe('CustomerError');
    expect(cu.code).toBe('CUSTOMER_ERROR');
  });
});

describe('base-processor — mapProcessorStatus', () => {
  it.each([
    ['succeeded', PaymentStatus.SUCCEEDED],
    ['completed', PaymentStatus.SUCCEEDED],
    ['paid', PaymentStatus.SUCCEEDED],
    ['failed', PaymentStatus.FAILED],
    ['declined', PaymentStatus.FAILED],
    ['cancelled', PaymentStatus.CANCELLED],
    ['refunded', PaymentStatus.REFUNDED],
    ['processing', PaymentStatus.PROCESSING],
    ['requires_action', PaymentStatus.PROCESSING],
    ['pending', PaymentStatus.PENDING],
    ['requires_payment_method', PaymentStatus.PENDING],
    ['something_unknown', PaymentStatus.PENDING],
  ])('maps %s -> %s', (input, expected) => {
    expect(mapProcessorStatus(input, PaymentProcessorType.STRIPE)).toBe(expected);
  });
});

describe('base-processor — inherited helpers & guards', () => {
  it('validateConfig throws when apiKey missing', async () => {
    const p = new TestProcessor();
    await expect(p.initialize({ apiKey: '' } as ProcessorConfig)).rejects.toThrow(
      'API key required',
    );
  });
  it('ensureInitialized throws before init, passes after', async () => {
    const p = new TestProcessor();
    expect(() => p.callEnsure()).toThrow('not initialized');
    await p.initialize({ apiKey: 'k', environment: 'test' });
    expect(() => p.callEnsure()).not.toThrow();
    p.callLogOperation();
    p.callLogError();
  });
  it('convertAmount handles zero-decimal and standard currencies', () => {
    const p = new TestProcessor();
    expect(p.convertAmount(new Decimal('1000'), 'JPY')).toBe(1000);
    expect(p.convertAmount(new Decimal('10.50'), 'USD')).toBe(1050);
  });
  it('formatAmount handles zero-decimal and standard currencies', () => {
    const p = new TestProcessor();
    expect(p.formatAmount(1000, 'JPY').toNumber()).toBe(1000);
    expect(p.formatAmount(1050, 'USD').toNumber()).toBe(10.5);
  });
});

describe('ManualProcessor', () => {
  const m = new ManualProcessor();

  it('has manual type and capabilities', () => {
    expect(m.type).toBe(PaymentProcessorType.MANUAL);
    expect(m.capabilities.supportsRefunds).toBe(true);
  });
  it('initialize is a no-op', async () => {
    await expect(m.initialize({ apiKey: 'manual' })).resolves.toBeUndefined();
  });
  it('createPaymentIntent returns a pending manual intent', async () => {
    const intent = await m.createPaymentIntent({ amount: new Decimal('5'), currency: 'CAD' });
    expect(intent.status).toBe(PaymentStatus.PENDING);
    expect(intent.processorType).toBe(PaymentProcessorType.MANUAL);
    expect(intent.id).toMatch(/^manual_pi_/);
  });
  it('retrieve/confirm/cancel return the expected statuses', async () => {
    expect((await m.retrievePaymentIntent('x')).status).toBe(PaymentStatus.PENDING);
    expect((await m.confirmPaymentIntent('x')).status).toBe(PaymentStatus.SUCCEEDED);
    expect((await m.cancelPaymentIntent('x')).status).toBe(PaymentStatus.CANCELLED);
  });
  it('createRefund with and without amount', async () => {
    const r1 = await m.createRefund({ paymentIntentId: 'pi', amount: new Decimal('3') });
    expect(r1.amount.toNumber()).toBe(3);
    expect(r1.status).toBe(PaymentStatus.REFUNDED);
    const r2 = await m.createRefund({ paymentIntentId: 'pi' });
    expect(r2.amount.toNumber()).toBe(0);
  });
  it('retrieveRefund returns a refunded result', async () => {
    expect((await m.retrieveRefund('rf')).status).toBe(PaymentStatus.REFUNDED);
  });
  it('customer + payment method ops return manual placeholders', async () => {
    expect(await m.createCustomer({ email: 'a@b.com' })).toMatch(/^manual_cus_/);
    expect((await m.retrieveCustomer('c')).id).toBe('c');
    expect((await m.updateCustomer('c', { name: 'N' })).name).toBe('N');
    expect((await m.attachPaymentMethod('pm', 'c')).id).toBe('pm');
    expect((await m.detachPaymentMethod('pm')).id).toBe('pm');
    expect(await m.listPaymentMethods('c')).toEqual([]);
  });
  it('webhook ops are inert', async () => {
    expect(await m.verifyWebhook('{}', 'sig')).toEqual({ verified: false });
    await expect(m.processWebhook({} as WebhookEvent)).resolves.toBeUndefined();
  });
  it('convert/format amount pass through', () => {
    expect(m.convertAmount(new Decimal('7'), 'CAD')).toBe(7);
    expect(m.formatAmount(7, 'CAD').toNumber()).toBe(7);
  });
});

describe('WhopProcessor', () => {
  const w = new WhopProcessor();

  it('has whop type and webhook-centric capabilities', () => {
    expect(w.type).toBe(PaymentProcessorType.WHOP);
    expect(w.capabilities.supportsWebhooks).toBe(true);
    expect(w.capabilities.supportsRefunds).toBe(false);
  });
  it('initialize delegates to base', async () => {
    await expect(w.initialize({ apiKey: 'whop' })).resolves.toBeUndefined();
  });
  it('unsupported payment-intent operations throw', async () => {
    await expect(w.createPaymentIntent({ amount: new Decimal('1'), currency: 'usd' })).rejects.toThrow();
    await expect(w.retrievePaymentIntent('x')).rejects.toThrow();
    await expect(w.confirmPaymentIntent('x')).rejects.toThrow();
    await expect(w.cancelPaymentIntent('x')).rejects.toThrow();
  });
  it('unsupported refund/customer/payment-method ops throw', async () => {
    await expect(w.createRefund({ paymentIntentId: 'pi' })).rejects.toThrow();
    await expect(w.retrieveRefund('rf')).rejects.toThrow();
    await expect(w.createCustomer({ email: 'a@b.com' })).rejects.toThrow();
    await expect(w.retrieveCustomer('c')).rejects.toThrow();
    await expect(w.updateCustomer('c', {})).rejects.toThrow();
    await expect(w.attachPaymentMethod('pm', 'c')).rejects.toThrow();
    await expect(w.detachPaymentMethod('pm')).rejects.toThrow();
    await expect(w.listPaymentMethods('c')).rejects.toThrow();
  });
  it('verifyWebhook parses payload and maps known + unknown actions', async () => {
    const known = await w.verifyWebhook(
      JSON.stringify({ id: 'evt1', action: 'membership.went_valid', data: { x: 1 } }),
      'sig',
    );
    expect(known.verified).toBe(true);
    expect(known.event?.type).toBe(WebhookEventType.SUBSCRIPTION_CREATED);

    const unknown = await w.verifyWebhook(
      JSON.stringify({ action: 'totally.unknown', data: {} }),
      'sig',
    );
    expect(unknown.verified).toBe(true);
    expect(unknown.event?.type).toBe(WebhookEventType.PAYMENT_SUCCEEDED);
  });
  it('verifyWebhook returns verified:false on invalid JSON', async () => {
    const res = await w.verifyWebhook('not-json', 'sig');
    expect(res.verified).toBe(false);
    expect(res.error).toBeDefined();
  });
  it('processWebhook is inert', async () => {
    await expect(
      w.processWebhook({ id: 'e', type: WebhookEventType.PAYMENT_SUCCEEDED } as WebhookEvent),
    ).resolves.toBeUndefined();
  });
});

describe('processor-factory — lifecycle', () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ access_token: 'tok', expires_in: 3600 }),
    })) as unknown as typeof fetch;
  });
  afterEach(() => {
    global.fetch = realFetch;
  });

  const fullConfig = (): ProcessorFactoryConfig => ({
    defaultProcessor: PaymentProcessorType.MANUAL,
    processors: {
      [PaymentProcessorType.STRIPE]: { apiKey: 'sk', environment: 'test' },
      [PaymentProcessorType.WHOP]: { apiKey: 'whop', environment: 'test' },
      [PaymentProcessorType.PAYPAL]: {
        apiKey: 'cid',
        environment: 'test',
        metadata: { clientSecret: 'secret' },
      },
      [PaymentProcessorType.SQUARE]: {
        apiKey: 'sq',
        environment: 'test',
        metadata: { applicationId: 'app' },
      },
      [PaymentProcessorType.MANUAL]: { apiKey: 'manual', environment: 'test' },
    },
  });

  it('getInstance returns a singleton', () => {
    const a = PaymentProcessorFactory.getInstance();
    const b = PaymentProcessorFactory.getInstance();
    expect(a).toBe(b);
  });

  it('getProcessor before initialize throws NOT_INITIALIZED', () => {
    const f = PaymentProcessorFactory.getInstance();
    expect(() => f.getProcessor()).toThrow('not initialized');
  });

  it('initialize wires all processor types and exposes them', async () => {
    const f = PaymentProcessorFactory.getInstance();
    await f.initialize(fullConfig());

    expect(f.getAvailableProcessors().length).toBe(5);
    expect(f.isProcessorAvailable(PaymentProcessorType.STRIPE)).toBe(true);
    expect(f.getProcessor(PaymentProcessorType.WHOP).type).toBe(PaymentProcessorType.WHOP);
    expect(f.getDefaultProcessor().type).toBe(PaymentProcessorType.MANUAL);
    expect(f.getProcessorCapabilities(PaymentProcessorType.SQUARE)).toBeDefined();
  });

  it('initialize is idempotent (second call warns and returns)', async () => {
    const f = PaymentProcessorFactory.getInstance();
    await f.initialize(fullConfig());
    await f.initialize(fullConfig());
    expect(f.getAvailableProcessors().length).toBe(5);
  });

  it('getProcessor for an unconfigured type throws PROCESSOR_UNAVAILABLE', async () => {
    const f = PaymentProcessorFactory.getInstance();
    await f.initialize({
      defaultProcessor: PaymentProcessorType.MANUAL,
      processors: { [PaymentProcessorType.MANUAL]: { apiKey: 'manual' } },
    });
    expect(() => f.getProcessor(PaymentProcessorType.STRIPE)).toThrow('not configured');
  });

  it('unknown non-default processor type is swallowed during init', async () => {
    const f = PaymentProcessorFactory.getInstance();
    const cfg = {
      defaultProcessor: PaymentProcessorType.MANUAL,
      processors: {
        ['bogus' as PaymentProcessorType]: { apiKey: 'x' },
        [PaymentProcessorType.MANUAL]: { apiKey: 'manual' },
      },
    } as ProcessorFactoryConfig;
    await expect(f.initialize(cfg)).resolves.toBeUndefined();
    expect(f.isProcessorAvailable(PaymentProcessorType.MANUAL)).toBe(true);
  });

  it('a failing default processor rejects initialize', async () => {
    const f = PaymentProcessorFactory.getInstance();
    const cfg = {
      defaultProcessor: 'bogus' as PaymentProcessorType,
      processors: { ['bogus' as PaymentProcessorType]: { apiKey: 'x' } },
    } as ProcessorFactoryConfig;
    await expect(f.initialize(cfg)).rejects.toThrow();
  });
});

describe('processor-factory — env loading', () => {
  const ENV_KEYS = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'WHOP_API_KEY',
    'WHOP_WEBHOOK_SECRET',
    'PAYPAL_CLIENT_ID',
    'PAYPAL_CLIENT_SECRET',
    'PAYPAL_WEBHOOK_ID',
    'SQUARE_ACCESS_TOKEN',
    'SQUARE_APPLICATION_ID',
    'SQUARE_WEBHOOK_SECRET',
  ];
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = {};
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('with no provider env vars, only MANUAL is configured', () => {
    const config = loadProcessorConfigFromEnv();
    expect(config.defaultProcessor).toBe(PaymentProcessorType.STRIPE);
    expect(config.processors[PaymentProcessorType.MANUAL]).toBeDefined();
    expect(config.processors[PaymentProcessorType.STRIPE]).toBeUndefined();
  });

  it('with all provider env vars set, every processor is configured', () => {
    process.env.STRIPE_SECRET_KEY = 'sk';
    process.env.WHOP_API_KEY = 'whop';
    process.env.PAYPAL_CLIENT_ID = 'cid';
    process.env.PAYPAL_CLIENT_SECRET = 'secret';
    process.env.SQUARE_ACCESS_TOKEN = 'tok';
    process.env.SQUARE_APPLICATION_ID = 'app';

    const config = loadProcessorConfigFromEnv();
    expect(config.processors[PaymentProcessorType.STRIPE]).toBeDefined();
    expect(config.processors[PaymentProcessorType.WHOP]).toBeDefined();
    expect(config.processors[PaymentProcessorType.PAYPAL]?.metadata?.clientSecret).toBe('secret');
    expect(config.processors[PaymentProcessorType.SQUARE]?.metadata?.applicationId).toBe('app');
  });

  it('initializePaymentProcessors builds + initializes from env', async () => {
    const realFetch = global.fetch;
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ access_token: 'tok', expires_in: 3600 }),
    })) as unknown as typeof fetch;
    try {
      const factory = await initializePaymentProcessors();
      expect(factory.isProcessorAvailable(PaymentProcessorType.MANUAL)).toBe(true);
    } finally {
      global.fetch = realFetch;
    }
  });
});
