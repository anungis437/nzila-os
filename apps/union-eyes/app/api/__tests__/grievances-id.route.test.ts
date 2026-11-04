import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  db: { select: vi.fn() },
  selectQueue: [] as unknown[][],
  getEffectiveCaseAccess: vi.fn(),
  listCaseCollaborators: vi.fn(),
  isDocumentVisibleByPolicy: vi.fn(),
  toGovernanceLabel: vi.fn(),
  trackPilotEvent: vi.fn(),
}));

vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule);
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (a: any, b?: any) => {
    const fn = typeof a === 'function' ? a : b;
    return fn({});
  },
  withSystemContext: async (fn: any) => fn({}),
}));

vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/services/case-access-service', () => ({
  getEffectiveCaseAccess: m.getEffectiveCaseAccess,
  listCaseCollaborators: m.listCaseCollaborators,
}));
vi.mock('@/lib/services/document-governance-service', () => ({
  isDocumentVisibleByPolicy: m.isDocumentVisibleByPolicy,
  toGovernanceLabel: m.toGovernanceLabel,
}));
vi.mock('@/lib/services/pilot-tracking', () => ({ trackPilotEvent: m.trackPilotEvent }));

const { caller, declared, resetCaller } = await import('./support/with-api-stub');

async function loadRoute() {
  return import('../grievances/[id]/route');
}

const G = '22222222-2222-4222-8222-222222222222';

describe('grievances/[id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCaller();
    caller.params = { id: G };
    m.selectQueue = [];
    m.getEffectiveCaseAccess.mockResolvedValue({ canViewCase: true, canManageAssignments: true, isPrimaryOwner: true, canViewPrivateDocuments: true });
    m.listCaseCollaborators.mockResolvedValue([{ id: 'k1', userId: 'u1', relation: 'assignee' }]);
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

  it('declares what it asks of the wrapper: a member, the case-suite entitlement and a tenant transaction', async () => {
    await loadRoute();
    const config = declared.find((entry) => entry.openapi?.summary === 'Fetch a grievance with its events and governed documents');
    expect(config?.auth).toEqual({ required: true, minRole: 'member' });
    expect(config?.entitlement).toBe('grievance_case_suite');
    expect(config?.rlsOrgContext).toBe(true);
  });

  it('returns validation error when the id is not a uuid, without querying', async () => {
    caller.params = { id: 'x' };
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/grievances/x'));
    expect(response.status).toBe(400);
    expect(m.db.select).not.toHaveBeenCalled();
  });

  it('returns forbidden below the member role', async () => {
    caller.role = 'guest';
    const { GET } = await loadRoute();
    const response = await GET(new Request(`http://localhost/api/grievances/${G}`));
    expect(response.status).toBe(403);
    expect(m.db.select).not.toHaveBeenCalled();
  });

  it('returns not found when the grievance is missing', async () => {
    const { GET } = await loadRoute();
    m.selectQueue = [[]];

    const response = await GET(new Request(`http://localhost/api/grievances/${G}`));

    expect(response.status).toBe(404);
  });

  it('returns grievance details payload', async () => {
    const { GET } = await loadRoute();
    m.selectQueue = [
      [{ id: G, createdBy: 'u1', unionRepId: 'u1', organizationId: 'org_1' }],
      [],
      [],
      [],
      [],
    ];

    const response = await GET(new Request(`http://localhost/api/grievances/${G}`));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({ id: G, createdBy: 'u1', primaryLroId: 'u1' });
    expect(m.listCaseCollaborators).toHaveBeenCalled();
    expect(m.trackPilotEvent).not.toHaveBeenCalled();
  });

  it('returns forbidden for a steward-level user with no ownership, grant or authorship', async () => {
    const { GET } = await loadRoute();

    // Seniority must not open the file.
    m.getEffectiveCaseAccess.mockResolvedValueOnce({
      canViewCase: false,
      canManageAssignments: false,
      isPrimaryOwner: false,
      canViewPrivateDocuments: false,
    });
    m.selectQueue = [[{ id: G, createdBy: 'other_user', unionRepId: 'u2', organizationId: 'org_1' }]];

    const response = await GET(new Request(`http://localhost/api/grievances/${G}`));

    expect(response.status).toBe(403);
    expect(m.selectQueue).toHaveLength(0);
    expect(m.trackPilotEvent).not.toHaveBeenCalled();
  });

  it('returns governed documents and tracks pilot access event', async () => {
    const { GET } = await loadRoute();
    m.getEffectiveCaseAccess.mockResolvedValueOnce({
      canViewCase: true,
      canManageAssignments: false,
      isPrimaryOwner: false,
      canViewPrivateDocuments: true,
    });
    m.isDocumentVisibleByPolicy.mockReturnValueOnce(true);
    m.selectQueue = [
      [{ id: G, createdBy: 'u2', unionRepId: 'u2', organizationId: 'org_1' }],
      [{ id: 'ev1' }],
      [{ id: 'legacy_1' }],
      [{ id: 'doc_1', title: 'Evidence', privacyLabel: 'team_confidential', createdAt: '2026-01-01T00:00:00.000Z' }],
      [{ documentId: 'doc_1' }],
      [{ id: 'collab_1' }],
    ];

    const response = await GET(new Request(`http://localhost/api/grievances/${G}`));
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

    const response = await GET(new Request(`http://localhost/api/grievances/${G}`));

    expect(response.status).toBe(500);
  });
});
