import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { declaredOptions } from './with-api-double';

const m = vi.hoisted(() => ({
  createCheckoutSession: vi.fn(),
  enabled: vi.fn(),
}));

vi.mock('@/lib/api/framework', async () => ({
  ...(await import('./with-api-double')).frameworkDouble,
  RATE_LIMITS: { FINANCIAL_WRITE: { limit: 5, window: 60 } },
}));
vi.mock('@/lib/services/payment-service', () => ({
  PaymentService: { createCheckoutSession: m.createCheckoutSession },
  PaymentAuthorityError: class PaymentAuthorityError extends Error {
    constructor(readonly code: 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT', message: string) {
      super(message);
    }
  },
}));
vi.mock('@/lib/audit/operation-audit', () => ({
  OperationAuditError: class OperationAuditError extends Error {},
}));
vi.mock('@/lib/dues/member-dues-flag', () => ({ isMemberDuesPaymentEnabled: m.enabled }));
vi.mock('@/lib/site-topology', () => ({ getUnionEyesSiteTopology: () => ({ appUrl: 'https://app.example.test' }) }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const TXN = '3f1c2a4e-5b6d-4e7f-8a9b-0c1d2e3f4a5b';
const valid = { transactionId: TXN, returnUrl: 'http://localhost/dashboard/dues?payment=returned', cancelUrl: 'http://localhost/dashboard/dues/pay/x?payment=cancelled' };
const caller = { userId: 'user-payer', organizationId: 'org_1' };

const checkout = (body: unknown) =>
  new NextRequest('http://localhost/api/payments/checkout/create', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const load = () => import('../payments/checkout/create/route');

describe('POST /api/payments/checkout/create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.enabled.mockReturnValue(true);
    m.createCheckoutSession.mockResolvedValue({
      sessionId: 'cs_1',
      checkoutUrl: 'https://checkout.example/cs_1',
      transactionId: TXN,
      amount: '40.00',
      currency: 'cad',
    });
  });

  it('asks the framework for an authenticated caller and a rate limit, and does not hold a transaction across the processor call', async () => {
    const { POST } = await load();
    const options = declaredOptions(POST);

    expect(options.auth).toEqual({ required: true });
    expect(options.rateLimit).toEqual({ limit: 5, window: 60 });
    expect(options.rlsOrgContext).toBeUndefined();
  });

  it('answers with the envelope the dues pay page reads, for the signed-in caller in their organization', async () => {
    const { POST } = await load();
    const response = await POST(checkout(valid), caller);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      data: { sessionId: 'cs_1', checkoutUrl: 'https://checkout.example/cs_1', transactionId: TXN, amount: '40.00', currency: 'cad' },
    });
    expect(m.createCheckoutSession).toHaveBeenCalledWith({
      transactionId: TXN,
      returnUrl: valid.returnUrl,
      cancelUrl: valid.cancelUrl,
      processorType: 'stripe',
      actor: { userId: 'user-payer', organizationId: 'org_1' },
    });
  });

  it('answers 501 without touching the payment service when the capability is off', async () => {
    m.enabled.mockReturnValue(false);
    const { POST } = await load();
    const response = await POST(checkout(valid), caller);

    expect(response.status).toBe(501);
    expect(await response.json()).toMatchObject({ code: 'NOT_IMPLEMENTED' });
    expect(m.createCheckoutSession).not.toHaveBeenCalled();
  });

  it('refuses a transaction id that is not a UUID, an address that is not a URL, and a body that is not JSON', async () => {
    const { POST } = await load();

    expect((await POST(checkout({ ...valid, transactionId: 'txn-1' }), caller)).status).toBe(400);
    expect((await POST(checkout({ ...valid, returnUrl: 'not a url' }), caller)).status).toBe(400);
    expect((await POST(checkout({ ...valid, processorType: 'bank' }), caller)).status).toBe(400);
    expect((await POST(new NextRequest('http://localhost/api/payments/checkout/create', { method: 'POST', body: '{broken' }), caller)).status).toBe(400);
    expect(m.createCheckoutSession).not.toHaveBeenCalled();
  });

  it('sends the payer back only to this application: another host or a script address is refused, and the application\'s own addresses are accepted', async () => {
    const { POST } = await load();

    for (const address of ['https://evil.test/phish', 'javascript:alert(1)', 'http://localhost.evil.test/x', 'data:text/html,hi']) {
      expect((await POST(checkout({ ...valid, returnUrl: address }), caller)).status).toBe(400);
      expect((await POST(checkout({ ...valid, cancelUrl: address }), caller)).status).toBe(400);
    }
    expect(m.createCheckoutSession).not.toHaveBeenCalled();

    const canonical = { ...valid, returnUrl: 'https://app.example.test/en/dashboard/dues', cancelUrl: 'https://app.example.test/en/dashboard/dues' };
    expect((await POST(checkout(canonical), caller)).status).toBe(200);
    expect((await POST(checkout(valid), caller)).status).toBe(200);
  });

  it('reports a transaction that is not the caller\'s as 404 and one that is not payable as 409', async () => {
    const { PaymentAuthorityError } = await import('@/lib/services/payment-service');
    const { POST } = await load();

    m.createCheckoutSession.mockRejectedValueOnce(new PaymentAuthorityError('NOT_FOUND', 'Transaction not found'));
    const notFound = await POST(checkout(valid), caller);
    expect(notFound.status).toBe(404);
    expect(await notFound.json()).toEqual({ error: 'Transaction not found' });

    m.createCheckoutSession.mockRejectedValueOnce(new PaymentAuthorityError('CONFLICT', 'Transaction status is paid, cannot create checkout session'));
    expect((await POST(checkout(valid), caller)).status).toBe(409);
  });

  it('reports an operation whose intent could not be recorded as 409, without calling it a success', async () => {
    const { OperationAuditError } = await import('@/lib/audit/operation-audit');
    m.createCheckoutSession.mockRejectedValueOnce(new OperationAuditError('intent not recorded'));
    const { POST } = await load();
    const response = await POST(checkout(valid), caller);

    expect(response.status).toBe(409);
  });

  it('answers 500, not a success, when the processor fails', async () => {
    m.createCheckoutSession.mockRejectedValueOnce(new Error('stripe down'));
    const { POST } = await load();
    const response = await POST(checkout(valid), caller);

    expect(response.status).toBe(500);
    expect(await response.json()).not.toHaveProperty('data');
  });
});
