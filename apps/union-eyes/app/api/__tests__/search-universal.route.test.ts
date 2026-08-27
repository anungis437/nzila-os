import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const TEST_ORG_ID = '00000000-0000-0000-0000-000000000001';
const TEST_USER_ID = 'user_test_001';

const m = vi.hoisted(() => {
  const state = {
    selectQueue: [] as unknown[][],
  };

  const nextSelect = () => Promise.resolve((state.selectQueue.shift() ?? []) as unknown[]);

  const createSelectChain = () => {
    const chain = {
      from: vi.fn(() => chain),
      leftJoin: vi.fn(() => chain),
      innerJoin: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      then: (resolve: (value: unknown[]) => unknown) => nextSelect().then(resolve),
    };
    return chain;
  };

  return {
    state,
    requireEntitlement: vi.fn(),
    hasMinRole: vi.fn(),
    getEffectiveCaseAccess: vi.fn(),
    isDocumentVisibleByPolicy: vi.fn(),
    normalizeDocumentTitle: vi.fn(),
    toGovernanceLabel: vi.fn(),
    queueSelect: (...rows: unknown[][]) => state.selectQueue.push(...rows),
    resetQueues: () => {
      state.selectQueue = [];
    },
    createSelectChain,
  };
});

const mockDb = {
  select: vi.fn(() => m.createSelectChain()),
};

vi.mock('@/db/db', () => ({ db: mockDb }));
vi.mock('@/lib/organization-middleware', () => ({
  withOrganizationAuth: vi.fn(
    (handler: (req: NextRequest, ctx: { organizationId: string; userId: string }) => Promise<Response>) =>
      (req: NextRequest) => handler(req, { organizationId: TEST_ORG_ID, userId: TEST_USER_ID })
  ),
}));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@/lib/services/case-access-service', () => ({ getEffectiveCaseAccess: m.getEffectiveCaseAccess }));
vi.mock('@/lib/services/document-governance-service', () => ({
  isDocumentVisibleByPolicy: m.isDocumentVisibleByPolicy,
  normalizeDocumentTitle: m.normalizeDocumentTitle,
  toGovernanceLabel: m.toGovernanceLabel,
}));

async function loadRoute() {
  return import('../search/universal/route');
}

describe('search/universal route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.resetQueues();
    m.requireEntitlement.mockResolvedValue(undefined);
    m.hasMinRole.mockResolvedValue(true);
    m.getEffectiveCaseAccess.mockResolvedValue({ isPrimaryOwner: true, canViewCase: true, canViewPrivateDocuments: true });
    m.isDocumentVisibleByPolicy.mockReturnValue(true);
    m.normalizeDocumentTitle.mockImplementation((row: { title?: string; filename?: string }) => row.title ?? row.filename ?? 'Untitled');
    m.toGovernanceLabel.mockReturnValue('team_confidential');
  });

  it('returns forbidden when caller lacks member role', async () => {
    const { GET } = await loadRoute();
    m.hasMinRole.mockResolvedValueOnce(false);

    const response = await GET(new NextRequest('http://localhost/api/search/universal?q=case'));

    expect(response.status).toBe(403);
  }, 60000);

  it('returns validation error for short search query', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/search/universal?q=a'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('returns grouped search results on success', async () => {
    const { GET } = await loadRoute();
    m.hasMinRole.mockResolvedValueOnce(true).mockResolvedValueOnce(true);

    m.queueSelect(
      [
        { id: 'case_1', grievanceNumber: 'GRV-1', title: 'Case one', status: 'filed', priority: 'high', updatedAt: new Date().toISOString() },
      ],
      [
        {
          id: 'doc_1', title: 'Case memo', filename: 'memo.pdf', documentType: 'memo', privacyLabel: 'team_confidential',
          updatedAt: new Date().toISOString(), linkedEntityType: 'grievance', linkedEntityId: 'case_1',
        },
      ],
      [{ id: 'grant_1' }],
      [
        { id: 'member_1', userId: 'u1', name: 'Casey Worker', email: 'casey@example.com', department: 'Ops', role: 'member', status: 'active', updatedAt: new Date().toISOString() },
      ],
      [
        { id: 'agr_1', cbaNumber: 'CBA-100', title: 'Main Agreement', employerName: 'Employer', status: 'active', updatedAt: new Date().toISOString() },
      ],
      [
        { id: 'note_1', grievanceId: 'case_1', eventType: 'note_added', notes: 'Case note text', createdAt: new Date().toISOString() },
      ],
    );

    const response = await GET(new NextRequest('http://localhost/api/search/universal?q=case'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.query).toBe('case');
    expect(payload.data.groups.cases.length).toBeGreaterThan(0);
    expect(payload.data.groups.documents.length).toBeGreaterThan(0);
  });

  it('filters governance-denied documents out of search results', async () => {
    const { GET } = await loadRoute();
    m.hasMinRole.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    m.getEffectiveCaseAccess.mockResolvedValue({ isPrimaryOwner: false, canViewCase: true, canViewPrivateDocuments: false });
    m.isDocumentVisibleByPolicy.mockReturnValue(false);

    m.queueSelect(
      [],
      [
        {
          id: 'doc_privileged',
          title: 'Privileged transition memo',
          filename: 'privileged-transition-memo.pdf',
          documentType: 'memo',
          privacyLabel: 'privileged',
          updatedAt: new Date().toISOString(),
          linkedEntityType: 'grievance',
          linkedEntityId: 'case_restricted',
        },
      ],
      [],
      [],
      [],
      [],
    );

    const response = await GET(new NextRequest('http://localhost/api/search/universal?q=transition'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.groups.documents).toEqual([]);
    expect(payload.data.totals.documents).toBe(0);
  });
});
