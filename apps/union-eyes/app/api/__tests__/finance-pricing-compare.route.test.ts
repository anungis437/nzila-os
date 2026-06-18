import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withMinRole: vi.fn(),
  requireEntitlement: vi.fn(),
  compareTiers: vi.fn(),
  projectRevenue: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withMinRole: m.withMinRole }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/services/platform-economics/pricing-calculator', () => ({
  compareTiers: m.compareTiers,
  projectRevenue: m.projectRevenue,
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
  standardSuccessResponse: (data: unknown) => new Response(JSON.stringify({ data }), { status: 200 }),
}));

async function loadRoute() {
  return import('../finance/pricing/compare/route');
}

describe('finance/pricing/compare route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withMinRole.mockImplementation(
      (_role: string, handler: (request: NextRequest, context: any) => Promise<Response>) =>
        (request: NextRequest, context: any = { organizationId: 'org_1', userId: 'u1' }) =>
          handler(request, context),
    );
    m.requireEntitlement.mockResolvedValue(undefined);
    m.compareTiers.mockReturnValue({ starter: 1000, professional: 2000 });
    m.projectRevenue.mockReturnValue([{ year: 1, revenue: 1000 }]);
  });

  it('POST returns 401 when user context missing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/finance/pricing/compare', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ memberCount: 100 }),
    }), { organizationId: 'org_1' });
    expect(response.status).toBe(401);
  });

  it('POST returns 403 when entitlement check fails', async () => {
    const { POST } = await loadRoute();
    m.requireEntitlement.mockRejectedValueOnce(new Error('Entitlement missing'));
    const response = await POST(new NextRequest('http://localhost/api/finance/pricing/compare', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ memberCount: 100 }),
    }), { organizationId: 'org_1', userId: 'u1' });
    expect(response.status).toBe(403);
  });

  it('POST returns 400 for invalid JSON', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/finance/pricing/compare', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    }), { organizationId: 'org_1', userId: 'u1' });
    expect(response.status).toBe(400);
  });

  it('POST returns 400 for invalid schema', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/finance/pricing/compare', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ memberCount: 0 }),
    }), { organizationId: 'org_1', userId: 'u1' });
    expect(response.status).toBe(400);
  });

  it('POST returns comparison payload without projections', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/finance/pricing/compare', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ memberCount: 100, regionCount: 2 }),
    }), { organizationId: 'org_1', userId: 'u1' });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.memberCount).toBe(100);
    expect(json.data.projections).toBeNull();
    expect(m.compareTiers).toHaveBeenCalledWith(100, 2);
  });

  it('POST computes projections when projectionYears is provided', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/finance/pricing/compare', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ memberCount: 100, regionCount: 2, projectionYears: 3 }),
    }), { organizationId: 'org_1', userId: 'u1' });

    expect(response.status).toBe(200);
    expect(m.projectRevenue).toHaveBeenCalledTimes(4);
  });

  it('POST returns 500 when compareTiers throws', async () => {
    const { POST } = await loadRoute();
    m.compareTiers.mockImplementationOnce(() => {
      throw new Error('calc failed');
    });

    const response = await POST(new NextRequest('http://localhost/api/finance/pricing/compare', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ memberCount: 100 }),
    }), { organizationId: 'org_1', userId: 'u1' });

    expect(response.status).toBe(500);
  });
});
