import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { declaredOptions } from './with-api-double';

const m = vi.hoisted(() => ({
  requireEntitlement: vi.fn(),
  getAllocationRules: vi.fn(),
  createAllocationRule: vi.fn(),
}));

vi.mock('@/lib/api/framework', async () => (await import('./with-api-double')).frameworkDouble);

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

const ctx = { organizationId: 'org_1', userId: 'u1' };

describe('finance/allocation route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireEntitlement.mockResolvedValue(undefined);
    m.getAllocationRules.mockResolvedValue([{ id: 'rule_1' }]);
    m.createAllocationRule.mockResolvedValue({ id: 'rule_new' });
  });

  describe('what the route asks of the wrapper', () => {
    it('lists rules for a secretary-treasurer, in the organization\'s own transaction, behind the allocation entitlement', async () => {
      const { GET } = await loadRoute();
      expect(declaredOptions(GET)).toMatchObject({
        auth: { minRole: 'secretary_treasurer' },
        entitlement: 'allocation_engine',
        rlsOrgContext: true,
        registry: { audience: 'officer', evidenceRequired: true },
      });
    });

    it('creates rules only for an administrator, in the organization\'s own transaction, behind the allocation entitlement', async () => {
      const { POST } = await loadRoute();
      expect(declaredOptions(POST)).toMatchObject({
        auth: { minRole: 'admin' },
        entitlement: 'allocation_engine',
        rlsOrgContext: true,
        registry: { audience: 'admin', evidenceRequired: true },
      });
    });
  });

  it('GET returns 403 when entitlement check fails, without reading rules', async () => {
    const { GET } = await loadRoute();
    m.requireEntitlement.mockRejectedValueOnce(new Error('Entitlement missing'));
    const response = await GET(new NextRequest('http://localhost/api/finance/allocation'), ctx);
    expect(response.status).toBe(403);
    expect(m.requireEntitlement).toHaveBeenCalledWith('org_1', 'allocation_engine', 'u1');
    expect(m.getAllocationRules).not.toHaveBeenCalled();
  });

  it('GET returns allocation rules of the caller organization', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/finance/allocation'), ctx);
    expect(response.status).toBe(200);
    expect(m.getAllocationRules).toHaveBeenCalledWith('org_1');
  });

  it('GET reports a read that failed as a 500, never as an empty list', async () => {
    const { GET } = await loadRoute();
    m.getAllocationRules.mockRejectedValueOnce(new Error('db down'));
    const response = await GET(new NextRequest('http://localhost/api/finance/allocation'), ctx);
    expect(response.status).toBe(500);
  });

  it('POST returns validation error for invalid JSON', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new NextRequest('http://localhost/api/finance/allocation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'bad-json',
      }),
      ctx,
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
      ctx,
    );
    expect(response.status).toBe(400);
    expect(m.createAllocationRule).not.toHaveBeenCalled();
  });

  it('POST creates the rule for the caller organization and user, whatever the body says', async () => {
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
          organizationId: 'org_other',
          createdBy: 'someone-else',
        }),
      }),
      ctx,
    );
    expect(response.status).toBe(200);
    expect(m.createAllocationRule).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org_1',
      createdBy: 'u1',
      name: 'Weighted Rule',
      method: 'weighted_hybrid',
    }));
  });
});
