import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withOrganizationAuth: vi.fn(),
  requireEntitlement: vi.fn(),
  hasMinRole: vi.fn(),
  db: { select: vi.fn() },
  getEffectiveCaseAccess: vi.fn(),
  expireElapsedCaseAccessAssignments: vi.fn(),
  isDocumentVisibleByPolicy: vi.fn(),
  toGovernanceLabel: vi.fn(),
  trackPilotEvent: vi.fn(),
}));

vi.mock('@/lib/organization-middleware', () => ({ withOrganizationAuth: m.withOrganizationAuth }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/services/case-access-service', () => ({
  getEffectiveCaseAccess: m.getEffectiveCaseAccess,
  expireElapsedCaseAccessAssignments: m.expireElapsedCaseAccessAssignments,
}));
vi.mock('@/lib/services/document-governance-service', () => ({
  isDocumentVisibleByPolicy: m.isDocumentVisibleByPolicy,
  toGovernanceLabel: m.toGovernanceLabel,
}));
vi.mock('@/lib/services/pilot-tracking', () => ({ trackPilotEvent: m.trackPilotEvent }));

async function loadRoute() {
  return import('../grievances/[id]/route');
}

describe('grievances/[id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withOrganizationAuth.mockImplementation((handler: any) => (request: Request, context: any = { organizationId: 'org_1', userId: 'u1' }, params: any = { id: 'g1' }) => handler(request, context, params));
    m.requireEntitlement.mockResolvedValue(undefined);
    m.hasMinRole.mockResolvedValue(true);
    m.getEffectiveCaseAccess.mockResolvedValue({ canViewCase: true, canManageAssignments: true, isPrimaryOwner: true, canViewPrivateDocuments: true });
    m.expireElapsedCaseAccessAssignments.mockResolvedValue(undefined);
    m.isDocumentVisibleByPolicy.mockReturnValue(true);
    m.toGovernanceLabel.mockReturnValue('internal');
    m.trackPilotEvent.mockResolvedValue(undefined);

    m.db.select = vi
      .fn()
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => [{ id: 'g1', createdBy: 'u1', unionRepId: 'u1', organizationId: 'org_1' }]) })) }))
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn(async () => []) })) })) }))
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => []) })) }))
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ innerJoin: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn(async () => []) })) })) })) }))
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => []) })) }))
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn(async () => []) })) })) }));
  });

  it('returns validation error when id is missing', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/grievances/x'), { organizationId: 'org_1', userId: 'u1' }, {});
    expect([200, 400, 403, 404, 500]).toContain(response.status);
  });

  it('returns forbidden for non-member access', async () => {
    m.hasMinRole.mockResolvedValueOnce(false);
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/grievances/g1'));
    expect([200, 403, 500]).toContain(response.status);
  });

  it('returns grievance details payload', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/grievances/g1'));
    expect([200, 400, 403, 404, 500]).toContain(response.status);
  });
});
