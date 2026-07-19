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

  it('returns 500 when PayPal webhook config is missing', async () => {
    const { POST } = await loadRoute();
    delete process.env.PAYPAL_WEBHOOK_ID;

    const response = await POST(makeRequest({ id: 'evt-1', event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: {} }));

    expect(response.status).toBe(500);
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

  it('returns non-retrying success envelope on unexpected verification errors', async () => {
    const { POST } = await loadRoute();
    const headers = {
      'content-type': 'application/json',
      'paypal-transmission-id': 'trans-1',
    };

    const response = await POST(makeRequest({ id: 'evt-err-1', event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: {} }, headers));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      received: true,
      error: 'Internal processing error',
    });
  });
});