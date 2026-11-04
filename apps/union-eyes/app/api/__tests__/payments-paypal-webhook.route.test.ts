import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  handlePaymentSuccess: vi.fn(),
  handlePaymentFailure: vi.fn(),
  isWebhookProcessed: vi.fn(),
  recordWebhookProcessed: vi.fn(),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/services/payment-service', () => ({
  PaymentService: {
    handlePaymentSuccess: m.handlePaymentSuccess,
    handlePaymentFailure: m.handlePaymentFailure,
  },
  PaymentAuthorityError: class PaymentAuthorityError extends Error {
    constructor(readonly code: string, message: string) {
      super(message);
    }
  },
}));
vi.mock('@/lib/services/rewards/webhook-service', () => ({
  isWebhookProcessed: m.isWebhookProcessed,
  recordWebhookProcessed: m.recordWebhookProcessed,
}));

function paypalHeaders() {
  return {
    'content-type': 'application/json',
    'paypal-transmission-id': 'trans-1',
    'paypal-transmission-time': '2026-06-11T00:00:00Z',
    'paypal-transmission-sig': 'sig-1',
    'paypal-cert-url': 'https://api-m.sandbox.paypal.com/cert',
    'paypal-auth-algo': 'SHA256withRSA',
  };
}

function makeRequest(payload: Record<string, unknown>, headers = paypalHeaders()) {
  return new NextRequest('http://localhost/api/payments/webhooks/paypal', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
}

async function loadRoute() {
  return import('../payments/webhooks/paypal/route');
}

describe('payments/webhooks/paypal route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PAYPAL_CLIENT_ID = 'paypal-client-id';
    process.env.PAYPAL_CLIENT_SECRET = 'paypal-client-secret';
    process.env.PAYPAL_WEBHOOK_ID = 'paypal-webhook-id';
    process.env.NODE_ENV = 'test';

    m.isWebhookProcessed.mockResolvedValue(false);
    m.recordWebhookProcessed.mockResolvedValue(undefined);
    m.handlePaymentSuccess.mockResolvedValue(undefined);
    m.handlePaymentFailure.mockResolvedValue(undefined);

    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/v1/oauth2/token')) {
        return new Response(JSON.stringify({ access_token: 'token-123' }), { status: 200 });
      }
      if (url.includes('/v1/notifications/verify-webhook-signature')) {
        return new Response(JSON.stringify({ verification_status: 'SUCCESS' }), { status: 200 });
      }
      return new Response('not-found', { status: 404 });
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns 503 when PayPal webhook config is missing', async () => {
    const { POST } = await loadRoute();
    delete process.env.PAYPAL_WEBHOOK_ID;

    const response = await POST(makeRequest({ id: 'evt-1', event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: {} }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: 'PayPal webhook not configured' });
  });

  it('returns 400 when PayPal verification fails', async () => {
    const { POST } = await loadRoute();
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/v1/oauth2/token')) {
        return new Response(JSON.stringify({ access_token: 'token-123' }), { status: 200 });
      }
      return new Response(JSON.stringify({ verification_status: 'FAILURE' }), { status: 200 });
    }));

    const response = await POST(makeRequest({ id: 'evt-1', event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: {} }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'Invalid PayPal signature' });
  });

  it('returns duplicate status when webhook was already processed', async () => {
    const { POST } = await loadRoute();
    m.isWebhookProcessed.mockResolvedValueOnce(true);

    const response = await POST(makeRequest({ id: 'evt-dup-1', event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: {} }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: 'duplicate' });
  });

  it('handles PAYMENT.CAPTURE.COMPLETED events', async () => {
    const { POST } = await loadRoute();
    const response = await POST(makeRequest({
      id: 'evt-success-1',
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: {
        id: 'pay-1',
        amount: { value: '42.50' },
        custom_id: 'txn-123',
      },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ received: true });
    expect(m.handlePaymentSuccess).toHaveBeenCalledWith(expect.objectContaining({
      transactionId: 'txn-123',
      processorPaymentId: 'pay-1',
      processorType: 'paypal',
    }));
    expect(m.recordWebhookProcessed).toHaveBeenCalled();
  });

  it('handles PAYMENT.CAPTURE.FAILED events', async () => {
    const { POST } = await loadRoute();
    const response = await POST(makeRequest({
      id: 'evt-fail-1',
      event_type: 'PAYMENT.CAPTURE.FAILED',
      resource: {
        id: 'pay-fail-1',
        status: 'FAILED',
        status_details: { reason: 'DECLINED' },
        custom_id: 'txn-999',
      },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ received: true });
    expect(m.handlePaymentFailure).toHaveBeenCalledWith(expect.objectContaining({
      transactionId: 'txn-999',
      processorPaymentId: 'pay-fail-1',
      errorCode: 'DECLINED',
    }));
  });

  it('answers 400 for a request without PayPal signature headers, and reads nothing from the database', async () => {
    const { POST } = await loadRoute();
    const headers = {
      'content-type': 'application/json',
      'paypal-transmission-id': 'trans-1',
    };

    const response = await POST(makeRequest({ id: 'evt-err-1', event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: {} }, headers));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'Missing PayPal signature headers' });
    expect(m.isWebhookProcessed).not.toHaveBeenCalled();
    expect(m.handlePaymentSuccess).not.toHaveBeenCalled();
  });

  it('answers 400 for a body that is not a JSON object, and 413 for one over the limit, before calling PayPal', async () => {
    const { POST } = await loadRoute();
    const raw = (body: string) => new NextRequest('http://localhost/api/payments/webhooks/paypal', { method: 'POST', headers: paypalHeaders(), body });

    expect((await POST(raw('not-json'))).status).toBe(400);
    expect((await POST(raw('[1,2]'))).status).toBe(400);
    expect((await POST(raw(JSON.stringify({ id: 'evt', padding: 'x'.repeat(300 * 1024) })))).status).toBe(413);
    expect(fetch).not.toHaveBeenCalled();
    expect(m.isWebhookProcessed).not.toHaveBeenCalled();
  });

  it('checks the signature before it reads or writes anything: an event PayPal does not vouch for touches no state', async () => {
    const { POST } = await loadRoute();
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/v1/oauth2/token')) return new Response(JSON.stringify({ access_token: 'token-123' }), { status: 200 });
      return new Response(JSON.stringify({ verification_status: 'FAILURE' }), { status: 200 });
    }));

    const response = await POST(makeRequest({ id: 'evt-forged', event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { id: 'pay-1', amount: { value: '1.00' }, custom_id: 'txn-1' } }));

    expect(response.status).toBe(400);
    expect(m.isWebhookProcessed).not.toHaveBeenCalled();
    expect(m.handlePaymentSuccess).not.toHaveBeenCalled();
    expect(m.recordWebhookProcessed).not.toHaveBeenCalled();
  });

  it('answers 500, so PayPal delivers the event again, when PayPal\u2019s verification service fails', async () => {
    const { POST } = await loadRoute();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('unavailable', { status: 503 })));

    const response = await POST(makeRequest({ id: 'evt-retry-1', event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: {} }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ received: false, error: 'Internal processing error' });
    expect(m.handlePaymentSuccess).not.toHaveBeenCalled();
  });

  it('answers 500 and does not record the event as processed when the payment cannot be recorded', async () => {
    const { POST } = await loadRoute();
    m.handlePaymentSuccess.mockRejectedValueOnce(new Error('connection reset'));

    const response = await POST(makeRequest({
      id: 'evt-db-down',
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: { id: 'pay-1', amount: { value: '42.50' }, custom_id: 'txn-123' },
    }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ received: false });
    expect(m.recordWebhookProcessed).not.toHaveBeenCalled();
  });

  it('answers 500 when the failure of a payment cannot be recorded', async () => {
    const { POST } = await loadRoute();
    m.handlePaymentFailure.mockRejectedValueOnce(new Error('connection reset'));

    const response = await POST(makeRequest({
      id: 'evt-fail-db-down',
      event_type: 'PAYMENT.CAPTURE.DENIED',
      resource: { id: 'pay-2', status: 'DENIED', custom_id: 'txn-9' },
    }));

    expect(response.status).toBe(500);
    expect(m.recordWebhookProcessed).not.toHaveBeenCalled();
  });

  it('answers 400 for a JSON object that is not a PayPal event, before calling PayPal', async () => {
    const { POST } = await loadRoute();

    for (const body of [{}, { id: 'evt-1' }, { event_type: 'PAYMENT.CAPTURE.COMPLETED' }, { id: 7, event_type: 'X' }, { id: 'evt-1', event_type: 'X', resource: 'nope' }]) {
      const response = await POST(makeRequest(body));
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ error: 'Invalid payload' });
    }
    expect(fetch).not.toHaveBeenCalled();
    expect(m.isWebhookProcessed).not.toHaveBeenCalled();
  });

  it('has PayPal verify the event exactly as PayPal sent it, fields the application does not read included', async () => {
    const { POST } = await loadRoute();
    const sent = { id: 'evt-raw', event_type: 'PAYMENT.CAPTURE.COMPLETED', create_time: '2026-06-11T00:00:00Z', resource: { id: 'pay-1', custom_id: 'txn-1', amount: { value: '1.00', currency_code: 'CAD' }, links: [{ rel: 'self' }] } };

    await POST(makeRequest(sent));

    const verifyCall = vi.mocked(fetch).mock.calls.find(([url]) => String(url).includes('/v1/notifications/verify-webhook-signature'));
    expect(JSON.parse(String(verifyCall?.[1]?.body)).webhook_event).toEqual(sent);
    expect(m.recordWebhookProcessed).toHaveBeenCalledWith(expect.objectContaining({ webhookId: 'evt-raw', payloadJson: sent }));
  });

  it('acts on no payment, and answers 200 so it is not redelivered, for a completed capture that names no capture', async () => {
    const { POST } = await loadRoute();

    const response = await POST(makeRequest({ id: 'evt-no-capture', event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { custom_id: 'txn-1', amount: { value: '1.00' } } }));

    expect(response.status).toBe(200);
    expect(m.handlePaymentSuccess).not.toHaveBeenCalled();
  });

  it('answers 422, not success and not a retry-into-nothing 5xx, for an event the application refuses', async () => {
    const { POST } = await loadRoute();
    const { PaymentAuthorityError } = await import('@/lib/services/payment-service');
    m.handlePaymentSuccess.mockRejectedValueOnce(new PaymentAuthorityError('CONFLICT', 'The paid amount differs from the amount on record'));

    const response = await POST(makeRequest({
      id: 'evt-conflict',
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: { id: 'pay-3', amount: { value: '1.00' }, custom_id: 'txn-5' },
    }));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ received: false, error: 'payment_rejected', code: 'CONFLICT' });
    expect(m.recordWebhookProcessed).not.toHaveBeenCalled();
  });
});