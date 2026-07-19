import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withMinRole: vi.fn(),
  requireEntitlement: vi.fn(),
  computeQuote: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withMinRole: m.withMinRole }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/services/platform-economics/pricing-calculator', () => ({ computeQuote: m.computeQuote }));
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
  standardSuccessResponse: (data: unknown) => new Response(JSON.stringify({ data }), { status: 200 }),
}));

async function loadRoute() {
  return import('../finance/pricing/quote/route');
}

describe('finance/pricing/quote route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withMinRole.mockImplementation(
      (_role: string, handler: (request: NextRequest, context: any) => Promise<Response>) =>
        (request: NextRequest, context: any = { organizationId: 'org_1', userId: 'u1' }) =>
          handler(request, context),
    );
    m.requireEntitlement.mockResolvedValue(undefined);
    m.computeQuote.mockReturnValue({ annualRevenue: 12000, tier: 'professional' });
  });

  it('POST returns 401 when organization or user missing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/finance/pricing/quote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ memberCount: 100 }),
    }), { organizationId: 'org_1' });
    expect(response.status).toBe(401);
  });

  it('POST returns 403 when entitlement check fails', async () => {
    const { POST } = await loadRoute();
    m.requireEntitlement.mockRejectedValueOnce(new Error('No entitlement'));
    const response = await POST(new NextRequest('http://localhost/api/finance/pricing/quote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ memberCount: 100 }),
    }), { organizationId: 'org_1', userId: 'u1' });
    expect(response.status).toBe(403);
  });

  it('POST returns 400 for invalid JSON', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/finance/pricing/quote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    }), { organizationId: 'org_1', userId: 'u1' });
    expect(response.status).toBe(400);
  });

  it('POST returns 400 for invalid quote schema', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/finance/pricing/quote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ memberCount: 0 }),
    }), { organizationId: 'org_1', userId: 'u1' });
    expect(response.status).toBe(400);
  });

  it('POST computes quote for valid payload', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/finance/pricing/quote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        memberCount: 250,
        tier: 'professional',
        regionCount: 2,
        contractTermMonths: 24,
      }),
    }), { organizationId: 'org_1', userId: 'u1' });

    expect(response.status).toBe(200);
    expect(m.computeQuote).toHaveBeenCalledWith(expect.objectContaining({ memberCount: 250, tier: 'professional' }));
  });

  it('POST passes custom discount rules through to computeQuote', async () => {
    const { POST } = await loadRoute();
    await POST(new NextRequest('http://localhost/api/finance/pricing/quote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        memberCount: 250,
        customDiscounts: [
          {
            type: 'custom',
            name: 'Pilot discount',
            ratePercent: 15,
            appliesTo: 'total',
          },
        ],
      }),
    }), { organizationId: 'org_1', userId: 'u1' });

    expect(m.computeQuote).toHaveBeenCalledWith(expect.objectContaining({ customDiscounts: expect.any(Array) }));
  });

  it('POST returns 500 when quote computation throws', async () => {
    const { POST } = await loadRoute();
    m.computeQuote.mockImplementationOnce(() => {
      throw new Error('pricing engine error');
    });

    const response = await POST(new NextRequest('http://localhost/api/finance/pricing/quote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ memberCount: 200 }),
    }), { organizationId: 'org_1', userId: 'u1' });

    expect(response.status).toBe(500);
  });
});
