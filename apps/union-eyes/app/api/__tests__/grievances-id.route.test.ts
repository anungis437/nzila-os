import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withOrganizationAuth: vi.fn(),
  requireEntitlement: vi.fn(),
  hasMinRole: vi.fn(),
  db: { select: vi.fn() },
  selectQueue: [] as unknown[][],
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
    m.selectQueue = [];
    m.withOrganizationAuth.mockImplementation((handler: any) => (request: Request, context: any = { organizationId: 'org_1', userId: 'u1' }, params: any = { id: 'g1' }) => handler(request, context, params));
    m.requireEntitlement.mockResolvedValue(undefined);
    m.hasMinRole.mockResolvedValue(true);
    m.getEffectiveCaseAccess.mockResolvedValue({ canViewCase: true, canManageAssignments: true, isPrimaryOwner: true, canViewPrivateDocuments: true });
    m.expireElapsedCaseAccessAssignments.mockResolvedValue(undefined);
    m.isDocumentVisibleByPolicy.mockReturnValue(true);
    m.toGovernanceLabel.mockReturnValue('internal');
    m.trackPilotEvent.mockResolvedValue(undefined);

    const createSelectChain = () => {
      const chain: any = {
        from: vi.fn(() => chain),
        where: vi.fn(() => chain),
        innerJoin: vi.fn(() => chain),
        orderBy: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        then: (resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) =>
          Promise.resolve((m.selectQueue.shift() ?? []) as unknown[]).then(resolve, reject),
      };
      return chain;
    };

    m.db.select = vi
      .fn()
      .mockImplementation(() => createSelectChain());
  });

  it('returns validation error when id is missing', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/grievances/x'), { organizationId: 'org_1', userId: 'u1' }, {});
    expect(response.status).toBe(400);
  });

  it('returns forbidden for non-member access', async () => {
    m.hasMinRole.mockResolvedValueOnce(false);
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/grievances/g1'));
    expect(response.status).toBe(403);
  });

  it('returns not found when the grievance is missing', async () => {
    const { GET } = await loadRoute();
    m.selectQueue = [[]];

    const response = await GET(new Request('http://localhost/api/grievances/g1'));

    expect(response.status).toBe(404);
  });

  it('returns grievance details payload', async () => {
    const { GET } = await loadRoute();
    m.selectQueue = [
      [{ id: 'g1', createdBy: 'u1', unionRepId: 'u1', organizationId: 'org_1' }],
      [],
      [],
      [],
      [],
    ];

    const response = await GET(new Request('http://localhost/api/grievances/g1'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({ id: 'g1', createdBy: 'u1', unionRepId: 'u1' });
    expect(m.expireElapsedCaseAccessAssignments).toHaveBeenCalled();
    expect(m.trackPilotEvent).not.toHaveBeenCalled();
  });

  it('returns forbidden when non-steward user has no ownership or delegated access', async () => {
    const { GET } = await loadRoute();

    m.hasMinRole
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    m.getEffectiveCaseAccess.mockResolvedValueOnce({
      canViewCase: false,
      canManageAssignments: false,
      isPrimaryOwner: false,
      canViewPrivateDocuments: false,
    });
    m.selectQueue = [[{ id: 'g1', createdBy: 'other_user', unionRepId: 'u2', organizationId: 'org_1' }]];

    const response = await GET(new Request('http://localhost/api/grievances/g1'));

    expect(response.status).toBe(403);
  });

  it('returns governed documents and tracks pilot access event', async () => {
    const { GET } = await loadRoute();
    m.hasMinRole
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    m.getEffectiveCaseAccess.mockResolvedValueOnce({
      canViewCase: true,
      canManageAssignments: false,
      isPrimaryOwner: false,
      canViewPrivateDocuments: true,
    });
    m.isDocumentVisibleByPolicy.mockReturnValueOnce(true);
    m.selectQueue = [
      [{ id: 'g1', createdBy: 'u2', unionRepId: 'u2', organizationId: 'org_1' }],
      [{ id: 'ev1' }],
      [{ id: 'legacy_1' }],
      [{ id: 'doc_1', title: 'Evidence', privacyLabel: 'team_confidential', createdAt: '2026-01-01T00:00:00.000Z' }],
      [{ documentId: 'doc_1' }],
      [{ id: 'collab_1' }],
    ];

    const response = await GET(new Request('http://localhost/api/grievances/g1'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.governedDocuments).toHaveLength(1);
    expect(payload.data.documents).toHaveLength(1);
    expect(m.trackPilotEvent).toHaveBeenCalled();
    expect(m.toGovernanceLabel).toHaveBeenCalled();
    expect(m.isDocumentVisibleByPolicy).toHaveBeenCalled();
  });

  it('returns internal error when query execution fails', async () => {
    const { GET } = await loadRoute();
    m.db.select.mockImplementationOnce(() => {
      throw new Error('db failure');
    });

    const response = await GET(new Request('http://localhost/api/grievances/g1'));

    expect(response.status).toBe(500);
  });
});
