import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withMinRole: vi.fn(),
  requireEntitlement: vi.fn(),
  getAllocationRules: vi.fn(),
  createAllocationRule: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({
  withMinRole: m.withMinRole,
}));

vi.mock('@/services/platform-economics/entitlement-guard', () => ({
  requireEntitlement: m.requireEntitlement,
}));

vi.mock('@/services/platform-economics', () => ({
  getAllocationRules: m.getAllocationRules,
  createAllocationRule: m.createAllocationRule,
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
  standardSuccessResponse: (data: unknown) =>
    new Response(JSON.stringify({ data }), { status: 200 }),
}));

async function loadRoute() {
  return import('../finance/allocation/route');
}

describe('finance/allocation route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withMinRole.mockImplementation(
      (_role: string, handler: (request: NextRequest, context: any) => Promise<Response>) =>
        (request: NextRequest, context: any = { organizationId: 'org_1', userId: 'user_1' }) =>
          handler(request, context),
    );
    m.requireEntitlement.mockResolvedValue(undefined);
    m.getAllocationRules.mockResolvedValue([{ id: 'rule_1' }]);
    m.createAllocationRule.mockResolvedValue({ id: 'rule_new' });
  });

  it('GET returns 401 without organization context', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/finance/allocation'), { userId: 'u1' });
    expect(response.status).toBe(401);
  });

  it('GET returns 403 when entitlement check fails', async () => {
    const { GET } = await loadRoute();
    m.requireEntitlement.mockRejectedValueOnce(new Error('Entitlement missing'));
    const response = await GET(new NextRequest('http://localhost/api/finance/allocation'), {
      organizationId: 'org_1',
      userId: 'u1',
    });
    expect(response.status).toBe(403);
  });

  it('GET returns allocation rules', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/finance/allocation'), {
      organizationId: 'org_1',
      userId: 'u1',
    });
    expect(response.status).toBe(200);
    expect(m.getAllocationRules).toHaveBeenCalledWith('org_1');
  });

  it('POST returns 401 when user context missing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new NextRequest('http://localhost/api/finance/allocation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Rule', costType: 'dues', method: 'per_member_count' }),
      }),
      { organizationId: 'org_1' },
    );
    expect(response.status).toBe(401);
  });

  it('POST returns validation error for invalid JSON', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new NextRequest('http://localhost/api/finance/allocation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'bad-json',
      }),
      { organizationId: 'org_1', userId: 'u1' },
    );
    expect(response.status).toBe(400);
  });

  it('POST returns validation error for invalid payload', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new NextRequest('http://localhost/api/finance/allocation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: '', method: 'unknown' }),
      }),
      { organizationId: 'org_1', userId: 'u1' },
    );
    expect(response.status).toBe(400);
  });

  it('POST creates allocation rule with valid payload', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new NextRequest('http://localhost/api/finance/allocation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Weighted Rule',
          costType: 'dues',
          method: 'weighted_hybrid',
          parameters: { memberWeight: 0.8 },
          effectiveFrom: '2026-07-01T00:00:00.000Z',
        }),
      }),
      { organizationId: 'org_1', userId: 'u1' },
    );
    expect(response.status).toBe(200);
    expect(m.createAllocationRule).toHaveBeenCalled();
  });
});
