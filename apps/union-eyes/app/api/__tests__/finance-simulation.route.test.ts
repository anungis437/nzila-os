import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { declaredOptions } from './with-api-double';

const m = vi.hoisted(() => {
  class AllocationRunError extends Error {
    constructor(readonly kind: 'not_found' | 'conflict', message: string) {
      super(message);
    }
  }
  return {
    requireEntitlement: vi.fn(),
    runAllocation: vi.fn(),
    AllocationRunError,
  };
});

vi.mock('@/lib/api/framework', async () => (await import('./with-api-double')).frameworkDouble);
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/services/platform-economics', () => ({ runAllocation: m.runAllocation, AllocationRunError: m.AllocationRunError }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: {
    AUTH_REQUIRED: 'AUTH_REQUIRED',
    FORBIDDEN: 'FORBIDDEN',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    CONFLICT: 'CONFLICT',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
  },
  standardErrorResponse: (code: string, message: string, details?: unknown) =>
    new Response(JSON.stringify({ code, message, details }), {
      status: code === 'AUTH_REQUIRED' ? 401 : code === 'FORBIDDEN' ? 403 : code === 'NOT_FOUND' ? 404 : code === 'CONFLICT' ? 409 : code === 'INTERNAL_ERROR' ? 500 : 400,
    }),
  standardSuccessResponse: (data: unknown) => new Response(JSON.stringify(data), { status: 200 }),
}));

const PERIOD = '550e8400-e29b-41d4-a716-446655440000';
const RULE = '550e8400-e29b-41d4-a716-446655440001';
const LOCAL = '550e8400-e29b-41d4-a716-446655440002';

async function loadRoute() {
  return import('../finance/simulation/route');
}

const simulation = (body: unknown) =>
  new NextRequest('http://localhost/api/finance/simulation', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const valid = { billingPeriodId: PERIOD, ruleId: RULE, localBasisData: [{ localId: LOCAL, memberCount: 10 }] };

describe('finance/simulation route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireEntitlement.mockResolvedValue(undefined);
    m.runAllocation.mockResolvedValue({ allocated: 100 });
  });

  it('keeps the role floor, the entitlement and the tenant transaction it had as a deprecated wrapper', async () => {
    const { POST } = await loadRoute();
    expect(declaredOptions(POST)).toMatchObject({
      auth: { minRole: 'secretary_treasurer' },
      entitlement: 'financial_intelligence_suite',
      rlsOrgContext: true,
    });
  });

  it('returns a simulation payload', async () => {
    const { POST } = await loadRoute();
    const response = await POST(simulation(valid), { organizationId: 'org_1', userId: 'u1' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ simulation: true, allocated: 100 });
    expect(m.runAllocation).toHaveBeenCalledWith(expect.objectContaining({ isSimulation: true, organizationId: 'org_1', createdBy: 'u1', billingPeriodId: PERIOD, ruleId: RULE }));
  });

  it('takes the organization from the session, never from the body', async () => {
    const { POST } = await loadRoute();
    await POST(simulation({ ...valid, organizationId: 'someone-elses-org' }), { organizationId: 'org_1', userId: 'u1' });

    expect(m.runAllocation).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org_1' }));
  });

  it('refuses an organization without the financial intelligence module, and runs nothing', async () => {
    m.requireEntitlement.mockRejectedValue(new Error('not entitled'));
    const { POST } = await loadRoute();
    const response = await POST(simulation(valid), { organizationId: 'org_1', userId: 'u1' });

    expect(response.status).toBe(403);
    expect(m.requireEntitlement).toHaveBeenCalledWith('org_1', 'financial_intelligence_suite', 'u1');
    expect(m.runAllocation).not.toHaveBeenCalled();
  });

  it('refuses ids that are not UUIDs and a body that is not JSON', async () => {
    const { POST } = await loadRoute();

    expect((await POST(simulation({ ...valid, ruleId: 'not-a-uuid' }), { organizationId: 'org_1', userId: 'u1' })).status).toBe(400);
    expect(
      (await POST(new NextRequest('http://localhost/api/finance/simulation', { method: 'POST', body: '{broken' }), { organizationId: 'org_1', userId: 'u1' })).status,
    ).toBe(400);
    expect(m.runAllocation).not.toHaveBeenCalled();
  });

  it('answers 500, not an empty success, when the allocation fails', async () => {
    m.runAllocation.mockRejectedValue(new Error('rule not found'));
    const { POST } = await loadRoute();
    const response = await POST(simulation(valid), { organizationId: 'org_1', userId: 'u1' });

    expect(response.status).toBe(500);
  });

  it('answers 404 for a period or rule that is not the organization\'s and 409 for a rule without an active version', async () => {
    const { POST } = await loadRoute();
    m.runAllocation.mockRejectedValueOnce(new m.AllocationRunError('not_found', 'Billing period x not found'));
    expect((await POST(simulation(valid), { organizationId: 'org_1', userId: 'u1' })).status).toBe(404);

    m.runAllocation.mockRejectedValueOnce(new m.AllocationRunError('conflict', 'No active version for rule r'));
    expect((await POST(simulation(valid), { organizationId: 'org_1', userId: 'u1' })).status).toBe(409);
  });
});
