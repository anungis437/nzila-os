import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withMinRole: vi.fn(),
  requireEntitlement: vi.fn(),
  getPayments: vi.fn(),
  recordPayment: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({
  withMinRole: m.withMinRole,
}));

vi.mock('@/services/platform-economics/entitlement-guard', () => ({
  requireEntitlement: m.requireEntitlement,
}));

vi.mock('@/services/platform-economics', () => ({
  getPayments: m.getPayments,
  recordPayment: m.recordPayment,
}));

vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: {
    AUTH_REQUIRED: 'AUTH_REQUIRED',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
  },
  standardErrorResponse: (code: string, message: string, details?: unknown) => {
    const status =
      code === 'AUTH_REQUIRED' ? 401 :
      code === 'INTERNAL_ERROR' ? 500 :
      400;
    return new Response(JSON.stringify({ code, message, details }), { status });
  },
  standardSuccessResponse: (data: unknown) =>
    new Response(JSON.stringify({ data }), { status: 200 }),
}));

async function loadRoute() {
  return import('../finance/invoices/[id]/payments/route');
}

describe('finance/invoices/[id]/payments route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withMinRole.mockImplementation(
      (_role: string, handler: (request: NextRequest, context: any) => Promise<Response>) =>
        (request: NextRequest, context: any = {
          organizationId: 'org_1',
          userId: 'user_1',
          params: Promise.resolve({ id: 'inv_1' }),
        }) => handler(request, context),
    );
    m.requireEntitlement.mockResolvedValue(undefined);
    m.getPayments.mockResolvedValue([{ id: 'pay_1' }]);
    m.recordPayment.mockResolvedValue({ id: 'pay_new' });
  });

  it('GET returns 401 without organization context', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/finance/invoices/inv_1/payments'), {
      userId: 'u1',
      params: Promise.resolve({ id: 'inv_1' }),
    });
    expect(response.status).toBe(401);
  });

  it('GET returns payments for invoice', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/finance/invoices/inv_1/payments'), {
      organizationId: 'org_1',
      userId: 'u1',
      params: Promise.resolve({ id: 'inv_1' }),
    });
    expect(response.status).toBe(200);
    expect(m.getPayments).toHaveBeenCalledWith('org_1', 'inv_1');
  });

  it('GET returns 500 when payments fetch fails', async () => {
    const { GET } = await loadRoute();
    m.getPayments.mockRejectedValueOnce(new Error('db error'));
    const response = await GET(new NextRequest('http://localhost/api/finance/invoices/inv_1/payments'), {
      organizationId: 'org_1',
      userId: 'u1',
      params: Promise.resolve({ id: 'inv_1' }),
    });
    expect(response.status).toBe(500);
  });

  it('POST returns 401 when user context missing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new NextRequest('http://localhost/api/finance/invoices/inv_1/payments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amount: '100.00', method: 'eft' }),
      }),
      {
        organizationId: 'org_1',
        params: Promise.resolve({ id: 'inv_1' }),
      },
    );
    expect(response.status).toBe(401);
  });

  it('POST returns validation error for invalid JSON', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new NextRequest('http://localhost/api/finance/invoices/inv_1/payments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'invalid-json',
      }),
      {
        organizationId: 'org_1',
        userId: 'u1',
        params: Promise.resolve({ id: 'inv_1' }),
      },
    );
    expect(response.status).toBe(400);
  });

  it('POST returns validation error for invalid amount format', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new NextRequest('http://localhost/api/finance/invoices/inv_1/payments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amount: '100', method: 'eft' }),
      }),
      {
        organizationId: 'org_1',
        userId: 'u1',
        params: Promise.resolve({ id: 'inv_1' }),
      },
    );
    expect(response.status).toBe(400);
  });

  it('POST records payment with valid payload', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new NextRequest('http://localhost/api/finance/invoices/inv_1/payments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amount: '100.50', method: 'eft', externalReference: 'bank-ref-1' }),
      }),
      {
        organizationId: 'org_1',
        userId: 'u1',
        params: Promise.resolve({ id: 'inv_1' }),
      },
    );
    expect(response.status).toBe(200);
    expect(m.recordPayment).toHaveBeenCalledWith({
      organizationId: 'org_1',
      invoiceId: 'inv_1',
      amount: '100.50',
      method: 'eft',
      externalReference: 'bank-ref-1',
      createdBy: 'u1',
    });
  });
});
