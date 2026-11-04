import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  requireKernelCaseAction: vi.fn(),
  withRLSContext: vi.fn(),
  recommendSteward: vi.fn(),
  auditDataMutation: vi.fn(),
}));

vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule);
vi.mock('@/lib/cases/case-authorization', () => ({ requireKernelCaseAction: m.requireKernelCaseAction }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/services/steward-assignment', () => ({ recommendSteward: m.recommendSteward }));
vi.mock('@/lib/audit-logger', () => ({ auditDataMutation: m.auditDataMutation }));

const { caller, declared, resetCaller } = await import('./support/with-api-stub');

async function loadRoute() {
  return import('../grievances/[id]/recommend-steward/route');
}

const GRIEVANCE = '22222222-2222-4222-8222-222222222222';
const post = () => new Request(`http://localhost/api/grievances/${GRIEVANCE}/recommend-steward`, { method: 'POST' });

describe('grievances/[id]/recommend-steward route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCaller();
    caller.params = { id: GRIEVANCE };
    m.requireKernelCaseAction.mockResolvedValue(undefined);
    m.withRLSContext.mockImplementation(async (_context: unknown, fn: (tx: unknown) => unknown) => fn({ tx: true }));
    m.recommendSteward.mockResolvedValue([{ stewardId: 'u2', score: 0.9 }]);
    m.auditDataMutation.mockResolvedValue(undefined);
  });

  it('declares what it asks of the wrapper: membership, the case-suite entitlement and a tenant transaction (the kernel decides who may assign)', async () => {
    await loadRoute();
    const config = declared.find((entry) => entry.openapi?.summary === 'Recommend stewards for a grievance');
    expect(config?.auth).toEqual({ required: true });
    expect(config?.entitlement).toBe('grievance_case_suite');
    expect(config?.rlsOrgContext).toBe(true);
  });

  it('answers 400 for a grievance id that is not a uuid', async () => {
    caller.params = { id: 'x' };
    const { POST } = await loadRoute();
    const response = await POST(post());
    expect(response.status).toBe(400);
    expect(m.requireKernelCaseAction).not.toHaveBeenCalled();
    expect(m.recommendSteward).not.toHaveBeenCalled();
  });

  it('answers 403 and recommends and audits nothing when the kernel denies case:assign', async () => {
    const { ApiError } = await import('@/lib/api/errors');
    m.requireKernelCaseAction.mockRejectedValueOnce(ApiError.forbidden());
    const { POST } = await loadRoute();
    const response = await POST(post());
    expect(response.status).toBe(403);
    expect(m.requireKernelCaseAction).toHaveBeenCalledWith({ tx: true }, { userId: 'u1', organizationId: 'org_1' }, GRIEVANCE, 'case:assign');
    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org_1' }, expect.any(Function));
    expect(m.recommendSteward).not.toHaveBeenCalled();
    expect(m.auditDataMutation).not.toHaveBeenCalled();
  });

  it('answers 404 when the grievance is not in the caller organization', async () => {
    const { ApiError } = await import('@/lib/api/errors');
    m.recommendSteward.mockRejectedValueOnce(ApiError.notFound('Grievance'));
    const { POST } = await loadRoute();
    const response = await POST(post());
    expect(response.status).toBe(404);
    expect(m.auditDataMutation).not.toHaveBeenCalled();
  });

  it('returns ranked steward recommendations, read on the same transaction as the kernel decision', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post());
    expect(response.status).toBe(200);
    expect(m.recommendSteward).toHaveBeenCalledWith('org_1', GRIEVANCE, { tx: true });
    expect(m.auditDataMutation).toHaveBeenCalledWith(expect.objectContaining({ resource: 'steward_recommendations', resourceId: GRIEVANCE, organizationId: 'org_1' }));
  });
});
