import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withOrganizationAuth: vi.fn(),
  requireEntitlement: vi.fn(),
  requireKernelCaseAction: vi.fn(),
  withRLSContext: vi.fn(),
  recommendSteward: vi.fn(),
  auditDataMutation: vi.fn(),
}));

vi.mock('@/lib/organization-middleware', () => ({ withOrganizationAuth: m.withOrganizationAuth }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/lib/cases/case-authorization', () => ({ requireKernelCaseAction: m.requireKernelCaseAction }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/services/steward-assignment', () => ({ recommendSteward: m.recommendSteward }));
vi.mock('@/lib/audit-logger', () => ({ auditDataMutation: m.auditDataMutation }));

async function loadRoute() {
  return import('../grievances/[id]/recommend-steward/route');
}

describe('grievances/[id]/recommend-steward route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withOrganizationAuth.mockImplementation((handler: any) => (request: Request, context: any = { organizationId: 'org_1', userId: 'u1' }, params: any = { id: 'g1' }) => handler(request, context, params));
    m.requireEntitlement.mockResolvedValue(undefined);
    m.requireKernelCaseAction.mockResolvedValue(undefined);
    m.withRLSContext.mockImplementation(async (_context: unknown, fn: (tx: unknown) => unknown) => fn({ tx: true }));
    m.recommendSteward.mockResolvedValue([{ stewardId: 'u2', score: 0.9 }]);
    m.auditDataMutation.mockResolvedValue(undefined);
  });

  it('returns validation error when id missing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/grievances/x/recommend-steward', { method: 'POST' }), { organizationId: 'org_1', userId: 'u1' }, {});
    expect(response.status).toBe(400);
    expect(m.requireKernelCaseAction).not.toHaveBeenCalled();
    expect(m.recommendSteward).not.toHaveBeenCalled();
  });

  it('answers 403 and recommends and audits nothing when the kernel denies case:assign', async () => {
    const { ApiError } = await import('@/lib/api/errors');
    m.requireKernelCaseAction.mockRejectedValueOnce(ApiError.forbidden());
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/grievances/g1/recommend-steward', { method: 'POST' }));
    expect(response.status).toBe(403);
    expect(m.requireKernelCaseAction).toHaveBeenCalledWith({ tx: true }, { userId: 'u1', organizationId: 'org_1' }, 'g1', 'case:assign');
    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org_1' }, expect.any(Function));
    expect(m.recommendSteward).not.toHaveBeenCalled();
    expect(m.auditDataMutation).not.toHaveBeenCalled();
  });

  it('returns ranked steward recommendations after the kernel allows case:assign', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/grievances/g1/recommend-steward', { method: 'POST' }));
    expect(response.status).toBe(200);
    expect(m.recommendSteward).toHaveBeenCalledWith('org_1', 'g1');
    expect(m.auditDataMutation).toHaveBeenCalledWith(expect.objectContaining({ resource: 'steward_recommendations', resourceId: 'g1' }));
  });
});
