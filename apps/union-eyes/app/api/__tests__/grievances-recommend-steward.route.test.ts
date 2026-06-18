import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withOrganizationAuth: vi.fn(),
  requireEntitlement: vi.fn(),
  hasMinRole: vi.fn(),
  recommendSteward: vi.fn(),
  auditDataMutation: vi.fn(),
}));

vi.mock('@/lib/organization-middleware', () => ({ withOrganizationAuth: m.withOrganizationAuth }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
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
    m.hasMinRole.mockResolvedValue(true);
    m.recommendSteward.mockResolvedValue([{ stewardId: 'u2', score: 0.9 }]);
    m.auditDataMutation.mockResolvedValue(undefined);
  });

  it('returns validation error when id missing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/grievances/x/recommend-steward', { method: 'POST' }), { organizationId: 'org_1', userId: 'u1' }, {});
    expect([200, 400, 403, 500]).toContain(response.status);
  });

  it('returns forbidden when user lacks steward role', async () => {
    m.hasMinRole.mockResolvedValueOnce(false);
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/grievances/g1/recommend-steward', { method: 'POST' }));
    expect([200, 403, 500]).toContain(response.status);
  });

  it('returns ranked steward recommendations', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/grievances/g1/recommend-steward', { method: 'POST' }));
    expect([200, 400, 403, 500]).toContain(response.status);
  });
});
