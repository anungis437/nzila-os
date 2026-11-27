import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { declaredOptions } from './with-api-double';
import { ErrorCode } from '@/lib/api/errors';

const REFUSAL = 'Finance and dues persistence are not available in this release.';

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
vi.mock('@/lib/api/standardized-responses', async () => (await import('./standard-responses-double')).standardResponsesDouble());

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

  it('declares the role floor and the tenant transaction mode it has under the base release boundary', async () => {
    const { POST } = await loadRoute();
    const options = declaredOptions(POST);
    expect(options).toMatchObject({
      auth: { minRole: 'secretary_treasurer' },
      rlsOrgContext: false,
    });
    expect(options.entitlement).toBeUndefined();
  });

  it('refuses a valid simulation with 501 NOT_IMPLEMENTED and runs nothing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(simulation(valid), { organizationId: 'org_1', userId: 'u1' });

    expect(response.status).toBe(501);
    expect(await response.json()).toMatchObject({ code: ErrorCode.NOT_IMPLEMENTED, message: REFUSAL });
    expect(m.runAllocation).not.toHaveBeenCalled();
  });

  it('refuses with 501 whatever the body names as its organization, and runs nothing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(simulation({ ...valid, organizationId: 'someone-elses-org' }), { organizationId: 'org_1', userId: 'u1' });

    expect(response.status).toBe(501);
    expect(await response.json()).toMatchObject({ code: ErrorCode.NOT_IMPLEMENTED, message: REFUSAL });
    expect(m.runAllocation).not.toHaveBeenCalled();
  });

  it('refuses with 501 whether or not the organization holds the module: no entitlement or allocation work runs', async () => {
    const { POST } = await loadRoute();
    for (const entitled of [true, false]) {
      m.requireEntitlement.mockReset();
      if (entitled) m.requireEntitlement.mockResolvedValue(undefined);
      else m.requireEntitlement.mockRejectedValue(new Error('not entitled'));
      const response = await POST(simulation(valid), { organizationId: 'org_1', userId: 'u1' });

      expect(response.status).toBe(501);
      expect(await response.json()).toMatchObject({ code: ErrorCode.NOT_IMPLEMENTED, message: REFUSAL });
    }
    expect(m.requireEntitlement).not.toHaveBeenCalled();
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

  it.each([
    ['an allocation that fails', () => m.runAllocation.mockRejectedValue(new Error('rule not found'))],
    ['a period or rule that is not the organization\'s', () => m.runAllocation.mockRejectedValue(new m.AllocationRunError('not_found', 'Billing period x not found'))],
    ['a rule without an active version', () => m.runAllocation.mockRejectedValue(new m.AllocationRunError('conflict', 'No active version for rule r'))],
  ])('never reaches the allocation engine, so %s cannot surface: 501 NOT_IMPLEMENTED', async (_label, arrange) => {
    arrange();
    const { POST } = await loadRoute();
    const response = await POST(simulation(valid), { organizationId: 'org_1', userId: 'u1' });

    expect(response.status).toBe(501);
    expect(await response.json()).toMatchObject({ code: ErrorCode.NOT_IMPLEMENTED, message: REFUSAL });
    expect(m.runAllocation).not.toHaveBeenCalled();
  });
});
