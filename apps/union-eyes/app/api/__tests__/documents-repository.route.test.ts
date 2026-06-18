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
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
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
    resolveStoredBlob: vi.fn(),
    auditCaseMutation: vi.fn(),
    withRLSContext: vi.fn(),
    queueSelect: (...results: unknown[][]) => state.selectQueue.push(...results),
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
vi.mock('@/services/platform-economics/entitlement-guard', () => ({
  requireEntitlement: m.requireEntitlement,
}));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@/lib/organization-middleware', () => ({
  withOrganizationAuth: vi.fn(
    (handler: (req: NextRequest, ctx: { organizationId: string; userId: string }) => Promise<Response>) =>
      (req: NextRequest) => handler(req, { organizationId: TEST_ORG_ID, userId: TEST_USER_ID })
  ),
}));
vi.mock('@/lib/services/case-access-service', () => ({
  getEffectiveCaseAccess: m.getEffectiveCaseAccess,
}));
vi.mock('@/lib/services/document-governance-service', () => ({
  isDocumentVisibleByPolicy: m.isDocumentVisibleByPolicy,
  normalizeDocumentTitle: m.normalizeDocumentTitle,
  toGovernanceLabel: m.toGovernanceLabel,
}));
vi.mock('@/lib/services/document-blob-integrity-service', () => ({
  resolveStoredBlob: m.resolveStoredBlob,
}));
vi.mock('@/lib/audited-case-mutations', () => ({
  auditCaseMutation: m.auditCaseMutation,
  CaseAuditEvent: { CASE_ATTACHMENT_UPLOADED: 'CASE_ATTACHMENT_UPLOADED' },
}));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: m.withRLSContext,
}));

async function loadRoute() {
  return import('../documents/repository/route');
}

describe('documents/repository route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.resetQueues();
    m.requireEntitlement.mockResolvedValue(undefined);
    m.hasMinRole.mockResolvedValue(true);
    m.getEffectiveCaseAccess.mockResolvedValue({
      isPrimaryOwner: true,
      canViewCase: true,
      canViewPrivateDocuments: true,
    });
    m.toGovernanceLabel.mockImplementation(({ privacyLabel }: { privacyLabel?: string }) => privacyLabel ?? 'team_confidential');
    m.isDocumentVisibleByPolicy.mockReturnValue(true);
    m.normalizeDocumentTitle.mockImplementation((row: { title?: string; name?: string }) => row.title ?? row.name ?? 'Untitled');
    m.resolveStoredBlob.mockResolvedValue({
      fileUrl: 'https://blob.example/test.pdf',
      blobPath: 'org/documents/test.pdf',
      contentHash: 'sha256:test',
    });
    m.auditCaseMutation.mockResolvedValue(undefined);

    m.withRLSContext.mockImplementation(async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => {
      let insertCall = 0;
      const tx = {
        insert: vi.fn(() => ({
          values: vi.fn(() => {
            insertCall += 1;
            if (insertCall === 1) {
              return {
                returning: vi.fn(async () => [{ id: 'doc-1', privacyLabel: 'team_confidential', documentType: 'policy' }]),
              };
            }
            return Promise.resolve(undefined);
          }),
        })),
      };
      return fn(tx);
    });
  });

  it('returns forbidden on GET when caller lacks member role', async () => {
    const { GET } = await loadRoute();
    m.hasMinRole.mockResolvedValueOnce(false);

    const response = await GET(new NextRequest('http://localhost/api/documents/repository'));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'FORBIDDEN' });
  }, 60000);

  it('returns only visible documents after policy checks', async () => {
    const { GET } = await loadRoute();
    m.hasMinRole.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    m.queueSelect([
      {
        id: 'doc-1',
        title: 'Doc One',
        name: 'Doc One',
        filename: 'doc1.pdf',
        documentType: 'policy',
        privacyLabel: 'team_confidential',
        uploadedBy: TEST_USER_ID,
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
        updatedAt: new Date('2026-06-01T00:00:00.000Z'),
        linkedEntityType: 'grievance',
        linkedEntityId: '00000000-0000-0000-0000-0000000000aa',
      },
      {
        id: 'doc-2',
        title: 'Doc Two',
        name: 'Doc Two',
        filename: 'doc2.pdf',
        documentType: 'policy',
        privacyLabel: 'highly_sensitive',
        uploadedBy: TEST_USER_ID,
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
        updatedAt: new Date('2026-06-01T00:00:00.000Z'),
        linkedEntityType: 'grievance',
        linkedEntityId: '00000000-0000-0000-0000-0000000000bb',
      },
    ]);
    m.isDocumentVisibleByPolicy.mockReturnValueOnce(true).mockReturnValueOnce(false);

    const response = await GET(new NextRequest('http://localhost/api/documents/repository'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]).toMatchObject({ id: 'doc-1', title: 'Doc One' });
  });

  it('returns forbidden on POST when caller lacks upload role', async () => {
    const { POST } = await loadRoute();
    m.hasMinRole.mockResolvedValueOnce(false);

    const response = await POST(new NextRequest('http://localhost/api/documents/repository', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Doc' }),
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('returns validation error when POST payload is invalid', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/documents/repository', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '', filename: '' }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('returns validation error when blob resolution fails', async () => {
    const { POST } = await loadRoute();
    m.resolveStoredBlob.mockRejectedValueOnce(new Error('Blob does not exist'));

    const response = await POST(new NextRequest('http://localhost/api/documents/repository', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Doc One',
        filename: 'doc1.pdf',
        fileUrl: 'https://blob.example/doc1.pdf',
        documentType: 'policy',
        mimeType: 'application/pdf',
        privacyLabel: 'team_confidential',
      }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR', message: 'Blob does not exist' });
  });

  it('creates linked grievance documents and emits case audit event', async () => {
    const { POST } = await loadRoute();

    const response = await POST(new NextRequest('http://localhost/api/documents/repository', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Doc One',
        filename: 'doc1.pdf',
        fileUrl: 'https://blob.example/doc1.pdf',
        documentType: 'policy',
        mimeType: 'application/pdf',
        privacyLabel: 'team_confidential',
        linkedEntityType: 'grievance',
        linkedEntityId: '00000000-0000-0000-0000-0000000000aa',
      }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data).toMatchObject({ id: 'doc-1' });
    expect(m.auditCaseMutation).toHaveBeenCalledWith(expect.objectContaining({
      caseId: '00000000-0000-0000-0000-0000000000aa',
      action: 'create',
    }));
  });
});