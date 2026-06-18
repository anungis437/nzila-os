import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withMinRole: vi.fn(),
  requireEntitlement: vi.fn(),
  getInvoices: vi.fn(),
  generateInvoice: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({
  withMinRole: m.withMinRole,
}));

vi.mock('@/services/platform-economics/entitlement-guard', () => ({
  requireEntitlement: m.requireEntitlement,
}));

vi.mock('@/services/platform-economics', () => ({
  getInvoices: m.getInvoices,
  generateInvoice: m.generateInvoice,
}));

vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: {
    AUTH_REQUIRED: 'AUTH_REQUIRED',
    FORBIDDEN: 'FORBIDDEN',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
  },
  standardErrorResponse: (code: string, message: string, details?: unknown) => {
    const status =
      code === 'AUTH_REQUIRED' ? 401 :
      code === 'FORBIDDEN' ? 403 :
      code === 'INTERNAL_ERROR' ? 500 :
      400;
    return new Response(JSON.stringify({ code, message, details }), { status });
  },
  standardSuccessResponse: (data: unknown, meta?: unknown) =>
    new Response(JSON.stringify({ data, meta }), { status: 200 }),
}));

async function loadRoute() {
  return import('../finance/invoices/route');
}

describe('finance/invoices route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withMinRole.mockImplementation(
      (_role: string, handler: (request: NextRequest, context: any) => Promise<Response>) =>
        (request: NextRequest, context: any = { organizationId: 'org_1', userId: 'user_1' }) =>
          handler(request, context),
    );
    m.requireEntitlement.mockResolvedValue(undefined);
    m.getInvoices.mockResolvedValue([{ id: 'inv_1' }]);
    m.generateInvoice.mockResolvedValue({ id: 'inv_new' });
  });

  it('GET returns 401 when organization context is missing', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/finance/invoices'), { userId: 'u1' });
    expect(response.status).toBe(401);
  });

  it('GET returns 403 when entitlement check fails', async () => {
    const { GET } = await loadRoute();
    m.requireEntitlement.mockRejectedValueOnce(new Error('Entitlement missing'));
    const response = await GET(new NextRequest('http://localhost/api/finance/invoices'), {
      organizationId: 'org_1',
      userId: 'u1',
    });
    expect(response.status).toBe(403);
  });

  it('GET uses capped limit from query params', async () => {
    const { GET } = await loadRoute();
    const response = await GET(
      new NextRequest('http://localhost/api/finance/invoices?limit=999&offset=10'),
      { organizationId: 'org_1', userId: 'u1' },
    );
    expect(response.status).toBe(200);
    expect(m.getInvoices).toHaveBeenCalledWith('org_1', 200);
  });

  it('GET returns 500 when invoice fetch throws', async () => {
    const { GET } = await loadRoute();
    m.getInvoices.mockRejectedValueOnce(new Error('db error'));
    const response = await GET(new NextRequest('http://localhost/api/finance/invoices'), {
      organizationId: 'org_1',
      userId: 'u1',
    });
    expect(response.status).toBe(500);
  });

  it('POST returns 401 when user context is missing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new NextRequest('http://localhost/api/finance/invoices', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ billingPeriodId: '12345678-1234-1234-1234-123456789012' }),
      }),
      { organizationId: 'org_1' },
    );
    expect(response.status).toBe(401);
  });

  it('POST returns validation error for invalid JSON', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new NextRequest('http://localhost/api/finance/invoices', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not-json',
      }),
      { organizationId: 'org_1', userId: 'u1' },
    );
    expect(response.status).toBe(400);
  });

  it('POST returns validation error for invalid body schema', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new NextRequest('http://localhost/api/finance/invoices', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ billingPeriodId: 'not-a-uuid' }),
      }),
      { organizationId: 'org_1', userId: 'u1' },
    );
    expect(response.status).toBe(400);
  });

  it('POST generates invoice on valid request', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new NextRequest('http://localhost/api/finance/invoices', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ billingPeriodId: '12345678-1234-1234-1234-123456789012' }),
      }),
      { organizationId: 'org_1', userId: 'u1' },
    );
    expect(response.status).toBe(200);
    expect(m.generateInvoice).toHaveBeenCalledWith({
      organizationId: 'org_1',
      billingPeriodId: '12345678-1234-1234-1234-123456789012',
      createdBy: 'u1',
    });
  });
});
