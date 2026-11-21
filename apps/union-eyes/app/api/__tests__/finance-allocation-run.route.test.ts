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
vi.mock('@/lib/api/standardized-responses', async () => (await import('./standard-responses-double')).standardResponsesDouble());
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/services/platform-economics', () => ({ runAllocation: m.runAllocation, AllocationRunError: m.AllocationRunError }));

async function loadRoute() {
  return import('../finance/allocation/run/route');
}

const valid = {
  billingPeriodId: '550e8400-e29b-41d4-a716-446655440000',
  ruleId: '550e8400-e29b-41d4-a716-446655440001',
  localBasisData: [{ localId: '550e8400-e29b-41d4-a716-446655440002', memberCount: 10 }],
};
const post = (body: unknown) => new NextRequest('http://localhost/api/finance/allocation/run', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

describe('finance/allocation/run route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireEntitlement.mockResolvedValue(undefined);
    m.runAllocation.mockResolvedValue({ allocated: 100 });
  });

  it('asks the wrapper for an administrator and declares no entitlement and no ambient tenant transaction', async () => {
    const { POST } = await loadRoute();
    const options = declaredOptions(POST);
    expect(options).toMatchObject({
      auth: { minRole: 'admin' },
      rlsOrgContext: false,
      registry: { audience: 'admin', evidenceRequired: true },
    });
    expect(options.entitlement).toBeUndefined();
  });

  it('refuses a valid run with 501 NOT_IMPLEMENTED, never a simulation or a result, and runs nothing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post({ ...valid, organizationId: 'org_other' }), { organizationId: 'org_1', userId: 'u1' });

    expect(response.status).toBe(501);
    expect(await response.json()).toMatchObject({ code: ErrorCode.NOT_IMPLEMENTED, message: REFUSAL });
    expect(m.runAllocation).not.toHaveBeenCalled();
  });

  it('refuses with 501 whether or not the organization holds the module: no entitlement or allocation work runs', async () => {
    const { POST } = await loadRoute();
    for (const entitled of [true, false]) {
      m.requireEntitlement.mockReset();
      if (entitled) m.requireEntitlement.mockResolvedValue(undefined);
      else m.requireEntitlement.mockRejectedValue(new Error('no module'));
      const response = await POST(post(valid), { organizationId: 'org_1', userId: 'u1' });

      expect(response.status).toBe(501);
      expect(await response.json()).toMatchObject({ code: ErrorCode.NOT_IMPLEMENTED, message: REFUSAL });
    }
    expect(m.requireEntitlement).not.toHaveBeenCalled();
    expect(m.runAllocation).not.toHaveBeenCalled();
  });

  it('answers a body that is not JSON, or does not match the run, as a client error, and runs nothing', async () => {
    const { POST } = await loadRoute();
    for (const body of ['{bad-json', { ...valid, billingPeriodId: 'not-a-uuid' }, { ...valid, localBasisData: 'x' }]) {
      const response = await POST(post(body), { organizationId: 'org_1', userId: 'u1' });
      expect(response.status).toBe(400);
    }
    expect(m.runAllocation).not.toHaveBeenCalled();
  });

  it.each([
    ['a run that fails', () => m.runAllocation.mockRejectedValue(new Error('period closed'))],
    ['a period, rule or cost the caller cannot act on (not found)', () => m.runAllocation.mockRejectedValue(new m.AllocationRunError('not_found', 'Billing period x not found'))],
    ['a period that is not open (conflict)', () => m.runAllocation.mockRejectedValue(new m.AllocationRunError('conflict', 'Billing period P1 is closed'))],
  ])('never reaches the allocation engine, so %s cannot surface: 501 NOT_IMPLEMENTED', async (_label, arrange) => {
    arrange();
    const { POST } = await loadRoute();
    const response = await POST(post(valid), { organizationId: 'org_1', userId: 'u1' });

    expect(response.status).toBe(501);
    expect(await response.json()).toMatchObject({ code: ErrorCode.NOT_IMPLEMENTED, message: REFUSAL });
    expect(m.runAllocation).not.toHaveBeenCalled();
  });

  it('bounds the locals a single run may allocate to', async () => {
    const { POST } = await loadRoute();
    const locals = Array.from({ length: 1001 }, (_, i) => ({ localId: `550e8400-e29b-41d4-a716-${String(i).padStart(12, '0')}`, memberCount: 1 }));
    const response = await POST(post({ ...valid, localBasisData: locals }), { organizationId: 'org_1', userId: 'u1' });

    expect(response.status).toBe(400);
    expect(m.runAllocation).not.toHaveBeenCalled();
  });
});
