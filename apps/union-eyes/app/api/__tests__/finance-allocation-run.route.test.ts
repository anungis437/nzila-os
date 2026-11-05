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

  it('asks the wrapper for an administrator, the allocation entitlement and the organization\'s own tenant transaction', async () => {
    const { POST } = await loadRoute();
    expect(declaredOptions(POST)).toMatchObject({
      auth: { minRole: 'admin' },
      entitlement: 'allocation_engine',
      rlsOrgContext: true,
      registry: { audience: 'admin', evidenceRequired: true },
    });
  });

  it('runs the allocation for the caller organization and user, never a simulation', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post({ ...valid, organizationId: 'org_other' }), { organizationId: 'org_1', userId: 'u1' });

    expect(response.status).toBe(200);
    expect(m.runAllocation).toHaveBeenCalledWith(expect.objectContaining({ isSimulation: false, organizationId: 'org_1', createdBy: 'u1' }));
  });

  it('is refused without the entitlement, and runs nothing', async () => {
    const { POST } = await loadRoute();
    m.requireEntitlement.mockRejectedValueOnce(new Error('no module'));
    const response = await POST(post(valid), { organizationId: 'org_1', userId: 'u1' });

    expect(response.status).toBe(403);
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

  it('reports a run that failed as a 500, never as a result', async () => {
    const { POST } = await loadRoute();
    m.runAllocation.mockRejectedValueOnce(new Error('period closed'));
    const response = await POST(post(valid), { organizationId: 'org_1', userId: 'u1' });

    expect(response.status).toBe(500);
  });

  it('answers a period, rule or cost the caller cannot act on as 404 (not there) or 409 (not open), never as a fault', async () => {
    const { POST } = await loadRoute();
    m.runAllocation.mockRejectedValueOnce(new m.AllocationRunError('not_found', 'Billing period x not found'));
    const notFound = await POST(post(valid), { organizationId: 'org_1', userId: 'u1' });
    expect(notFound.status).toBe(404);

    m.runAllocation.mockRejectedValueOnce(new m.AllocationRunError('conflict', 'Billing period P1 is closed'));
    const conflict = await POST(post(valid), { organizationId: 'org_1', userId: 'u1' });
    expect(conflict.status).toBe(409);
  });

  it('bounds the locals a single run may allocate to', async () => {
    const { POST } = await loadRoute();
    const locals = Array.from({ length: 1001 }, (_, i) => ({ localId: `550e8400-e29b-41d4-a716-${String(i).padStart(12, '0')}`, memberCount: 1 }));
    const response = await POST(post({ ...valid, localBasisData: locals }), { organizationId: 'org_1', userId: 'u1' });

    expect(response.status).toBe(400);
    expect(m.runAllocation).not.toHaveBeenCalled();
  });
});
