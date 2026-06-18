import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withOrganizationAuth: vi.fn(),
  requireEntitlement: vi.fn(),
  hasMinRole: vi.fn(),
  isDocumentVisibleByPolicy: vi.fn(),
  normalizeDocumentTitle: vi.fn(),
  toGovernanceLabel: vi.fn(),
  getEffectiveCaseAccess: vi.fn(),
  getDocumentMutabilityBlockReason: vi.fn(),
  auditCaseMutation: vi.fn(),
  standardErrorResponse: vi.fn(),
  standardSuccessResponse: vi.fn(),
  selectQueue: [] as unknown[][],
  updateReturningQueue: [] as unknown[][],
}));

function makeSelectChain(rows: unknown[]) {
  const chain: any = {
    from: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(async () => rows),
    orderBy: vi.fn(async () => rows),
  };
  return chain;
}

const mockDb: any = {
  select: vi.fn(() => makeSelectChain((m.selectQueue.shift() ?? []) as unknown[])),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(async () => (m.updateReturningQueue.shift() ?? []) as unknown[]),
      })),
    })),
  })),
};

vi.mock('@/lib/organization-middleware', () => ({ withOrganizationAuth: m.withOrganizationAuth }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@/db/db', () => ({ db: mockDb }));
vi.mock('@/lib/services/document-governance-service', () => ({
  isDocumentVisibleByPolicy: m.isDocumentVisibleByPolicy,
  normalizeDocumentTitle: m.normalizeDocumentTitle,
  toGovernanceLabel: m.toGovernanceLabel,
}));
vi.mock('@/lib/services/case-access-service', () => ({ getEffectiveCaseAccess: m.getEffectiveCaseAccess }));
vi.mock('@/lib/services/document-retention-guard', () => ({ getDocumentMutabilityBlockReason: m.getDocumentMutabilityBlockReason }));
vi.mock('@/lib/audited-case-mutations', () => ({
  auditCaseMutation: m.auditCaseMutation,
  CaseAuditEvent: { DOCUMENT_LABEL_CHANGED: 'DOCUMENT_LABEL_CHANGED' },
}));
vi.mock('@/db/schema/documents-schema', () => ({
  documents: { id: 'id', title: 'title', filename: 'filename', name: 'name', fileUrl: 'fileUrl', documentType: 'documentType', privacyLabel: 'privacyLabel', uploadedBy: 'uploadedBy', createdAt: 'createdAt', updatedAt: 'updatedAt', organizationId: 'organizationId', metadata: 'metadata', deletedAt: 'deletedAt' },
  documentAccessGrants: { id: 'id', organizationId: 'organizationId', documentId: 'documentId', userId: 'userId', status: 'status', canView: 'canView', revokedAt: 'revokedAt', expiresAt: 'expiresAt' },
  documentLinks: { documentId: 'documentId', linkedEntityType: 'linkedEntityType', linkedEntityId: 'linkedEntityId' },
  documentVersions: { organizationId: 'organizationId', documentId: 'documentId', versionNo: 'versionNo' },
}));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { FORBIDDEN: 'FORBIDDEN', VALIDATION_ERROR: 'VALIDATION_ERROR', NOT_FOUND: 'NOT_FOUND', CONFLICT: 'CONFLICT' },
  standardErrorResponse: m.standardErrorResponse,
  standardSuccessResponse: m.standardSuccessResponse,
}));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, and: vi.fn(() => 'and'), desc: vi.fn(() => 'desc'), eq: vi.fn(() => 'eq'), sql: vi.fn((s: any) => s) };
});

async function loadRoute() {
  return import('../documents/repository/[id]/route');
}

describe('documents/repository/[id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.updateReturningQueue = [];
    m.withOrganizationAuth.mockImplementation((handler: any) => (_req: Request, context: any = { organizationId: 'org_1', userId: 'u1' }, params: any = { id: 'd1' }) => handler(_req, context, params));
    m.requireEntitlement.mockResolvedValue(undefined);
    m.hasMinRole.mockResolvedValue(true);
    m.isDocumentVisibleByPolicy.mockReturnValue(true);
    m.normalizeDocumentTitle.mockReturnValue('Doc');
    m.toGovernanceLabel.mockReturnValue('public_internal');
    m.getEffectiveCaseAccess.mockResolvedValue({ isPrimaryOwner: true, canViewCase: true, canViewPrivateDocuments: true });
    m.getDocumentMutabilityBlockReason.mockReturnValue(null);
    m.auditCaseMutation.mockResolvedValue(undefined);
    m.standardErrorResponse.mockImplementation((code: string, message: string) => new Response(JSON.stringify({ code, message }), { status: code === 'FORBIDDEN' ? 403 : code === 'NOT_FOUND' ? 404 : code === 'CONFLICT' ? 409 : 400 }));
    m.standardSuccessResponse.mockImplementation((data: unknown) => new Response(JSON.stringify(data), { status: 200 }));
  });

  it('GET returns 403 when member read permission is denied', async () => {
    const { GET } = await loadRoute();
    m.hasMinRole.mockResolvedValueOnce(false);

    const response = await GET(new Request('http://localhost/api/documents/repository/d1'), { organizationId: 'org_1', userId: 'u1' }, { id: 'd1' });
    expect(response.status).toBe(403);
  });

  it('GET returns 404 when document does not exist', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([]);

    const response = await GET(new Request('http://localhost/api/documents/repository/d1'), { organizationId: 'org_1', userId: 'u1' }, { id: 'd1' });
    expect(response.status).toBe(404);
  });

  it('GET returns visible document with versions', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push(
      [{ id: 'd1', privacyLabel: 'public_internal', linkedEntityType: null, linkedEntityId: null, title: 'Doc' }],
      [],
      [{ id: 'v1', versionNo: 2 }],
    );

    const response = await GET(new Request('http://localhost/api/documents/repository/d1'), { organizationId: 'org_1', userId: 'u1' }, { id: 'd1' });
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.versions).toHaveLength(1);
  });

  it('PATCH returns 400 for invalid payload', async () => {
    const { PATCH } = await loadRoute();
    const response = await PATCH(new Request('http://localhost/api/documents/repository/d1', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ privacyLabel: 'invalid' }),
    }), { organizationId: 'org_1', userId: 'u1' }, { id: 'd1' });

    expect(response.status).toBe(400);
  });

  it('PATCH returns 409 when retention guard blocks update', async () => {
    const { PATCH } = await loadRoute();
    m.selectQueue.push([{ id: 'd1', privacyLabel: 'public_internal', metadata: {}, linkedEntityType: null, linkedEntityId: null }]);
    m.getDocumentMutabilityBlockReason.mockReturnValueOnce('legal_hold');

    const response = await PATCH(new Request('http://localhost/api/documents/repository/d1', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ privacyLabel: 'team_confidential' }),
    }), { organizationId: 'org_1', userId: 'u1' }, { id: 'd1' });

    expect(response.status).toBe(409);
  });

  it('PATCH updates label and returns updated document', async () => {
    const { PATCH } = await loadRoute();
    m.selectQueue.push([{ id: 'd1', privacyLabel: 'public_internal', metadata: {}, linkedEntityType: 'grievance', linkedEntityId: 'g1' }]);
    m.updateReturningQueue.push([{ id: 'd1', privacyLabel: 'team_confidential' }]);

    const response = await PATCH(new Request('http://localhost/api/documents/repository/d1', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ privacyLabel: 'team_confidential' }),
    }), { organizationId: 'org_1', userId: 'u1' }, { id: 'd1' });

    expect(response.status).toBe(200);
    expect(m.auditCaseMutation).toHaveBeenCalled();
  });
});
