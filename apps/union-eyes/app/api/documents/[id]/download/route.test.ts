import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const selectQueue: any[][] = [];

  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        leftJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => selectQueue.shift() ?? []),
            orderBy: vi.fn(() => ({
              limit: vi.fn(async () => selectQueue.shift() ?? []),
            })),
          })),
        })),
        where: vi.fn(() => ({
          limit: vi.fn(async () => selectQueue.shift() ?? []),
          orderBy: vi.fn(() => ({
            limit: vi.fn(async () => selectQueue.shift() ?? []),
          })),
        })),
      })),
    })),
    _selectQueue: selectQueue,
  };

  return {
    db,
    hasMinRole: vi.fn(),
    getEffectiveCaseAccess: vi.fn(),
    isDocumentVisibleByPolicy: vi.fn(),
    generateSasUrl: vi.fn(),
    persistAtomicAudit: vi.fn(async () => undefined),
  };
});

vi.mock('@/lib/api/framework', async () => (await import('@/app/api/__tests__/support/with-api-stub')).frameworkModule);

// The route opens its own organization transaction: here that is the scripted handle every statement of the issuance goes through.
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_context: unknown, operation: (tx: unknown) => Promise<unknown>) => operation(mocks.db),
}));

vi.mock('@/lib/api-auth-guard', () => ({
  hasMinRole: mocks.hasMinRole,
}));

// The ambient handle must never be reached by this route.
vi.mock('@/db/db', () => ({
  db: new Proxy({}, { get() { throw new Error('the ambient database handle was used'); } }),
}));

vi.mock('@/lib/services/case-access-service', () => ({
  getEffectiveCaseAccess: mocks.getEffectiveCaseAccess,
}));

vi.mock('@/lib/services/document-governance-service', () => ({
  isDocumentVisibleByPolicy: mocks.isDocumentVisibleByPolicy,
  toGovernanceLabel: vi.fn(() => 'team_confidential'),
}));

vi.mock('@/lib/blob-client', () => ({
  generateSasUrl: mocks.generateSasUrl,
}));

vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: mocks.persistAtomicAudit }));

const previousSealKey = process.env.EVIDENCE_SEAL_KEY;
const SYNTHETIC_SEAL_KEY = 'synthetic-document-download-lease-key-only-20261124';
const VERSION_ID = '22222222-2222-4222-8222-222222222222';
const VERSION = { id: VERSION_ID, versionNo: 1, storageKey: 'documents/org-1/file.pdf', contentHash: 'a'.repeat(64), metadata: { sizeBytes: 1 } };
const DOCUMENT_ID = '11111111-1111-4111-8111-111111111111';

const { verifyDocumentDownloadLease, DOCUMENT_DOWNLOAD_LEASE_MS } = await import('@/lib/documents/download-lease');
const { GET: route } = await import('@/app/api/documents/[id]/download/route');
const { caller, declared, resetCaller } = await import('@/app/api/__tests__/support/with-api-stub');

// The wrapper resolves the caller and the route params; the calls below name them as they always did.
const GET = (request: Request, context: { organizationId: string; userId: string }, params: { id: string }) => {
  caller.organizationId = context.organizationId;
  caller.userId = context.userId;
  return route(request, { params });
};

afterEach(() => {
  if (previousSealKey === undefined) delete process.env.EVIDENCE_SEAL_KEY;
  else process.env.EVIDENCE_SEAL_KEY = previousSealKey;
});

describe('GET /api/documents/[id]/download', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCaller();
    caller.role = 'member';
    mocks.db._selectQueue.length = 0;
    mocks.hasMinRole.mockResolvedValue(false);
    mocks.getEffectiveCaseAccess.mockResolvedValue({
      isPrimaryOwner: false,
      canViewCase: true,
      canViewPrivateDocuments: false,
    });
    process.env.EVIDENCE_SEAL_KEY = SYNTHETIC_SEAL_KEY;
    mocks.generateSasUrl.mockImplementation(() => { throw new Error('Storage signing must not be used for application leases'); });
    mocks.persistAtomicAudit.mockResolvedValue(undefined);
  });

  it('declares a member floor and the case-suite entitlement; a caller below the floor reaches no statement', async () => {
    expect(declared.at(-1)).toMatchObject({ auth: { required: true, minRole: 'member' }, entitlement: 'grievance_case_suite' });
    caller.role = 'guest';
    const res = await GET(new Request(`https://example.com/api/documents/${DOCUMENT_ID}/download`), { organizationId: 'org-1', userId: 'user-1' }, { id: DOCUMENT_ID });

    expect(res.status).toBe(403);
    expect(mocks.db.select).not.toHaveBeenCalled();
  });

  it('denies download when governance policy denies access', async () => {
    mocks.db._selectQueue.push(
      [{
        id: DOCUMENT_ID,
        title: 'A',
        name: 'A',
        filename: 'a.pdf',
        fileUrl: 'https://old',
        mimeType: 'application/pdf',
        privacyLabel: 'privileged',
        linkedEntityType: 'grievance',
        linkedEntityId: 'case-1',
      }],
      [],
      [{ ...VERSION }],
    );
    mocks.isDocumentVisibleByPolicy.mockReturnValue(false);

    const res = await GET(new Request(`https://example.com/api/documents/${DOCUMENT_ID}/download`), {
      organizationId: 'org-1',
      userId: 'user-1',
    }, { id: DOCUMENT_ID });

    expect(res.status).toBe(403);
  });

  it('denies download when an explicit grant allows view but not download', async () => {
    mocks.db._selectQueue.push(
      [{
        id: DOCUMENT_ID,
        title: 'A',
        name: 'A',
        filename: 'a.pdf',
        fileUrl: 'https://old',
        mimeType: 'application/pdf',
        privacyLabel: 'privileged',
        linkedEntityType: 'grievance',
        linkedEntityId: 'case-1',
      }],
      [{ id: 'grant-1', canDownload: false }],
      [{ ...VERSION }],
    );
    mocks.isDocumentVisibleByPolicy.mockReturnValue(true);

    const res = await GET(new Request(`https://example.com/api/documents/${DOCUMENT_ID}/download`), {
      organizationId: 'org-1',
      userId: 'user-1',
    }, { id: DOCUMENT_ID });

    expect(res.status).toBe(403);
    expect(mocks.generateSasUrl).not.toHaveBeenCalled();
  });

  it('returns an audited actor-bound application lease when access is allowed', async () => {
    mocks.db._selectQueue.push(
      [{
        id: DOCUMENT_ID,
        title: 'A',
        name: 'A',
        filename: 'a.pdf',
        fileUrl: 'https://old',
        mimeType: 'application/pdf',
        privacyLabel: 'team_confidential',
        linkedEntityType: null,
        linkedEntityId: null,
      }],
      [],
      [{ ...VERSION }],
    );
    mocks.isDocumentVisibleByPolicy.mockReturnValue(true);

    const res = await GET(new Request(`https://example.com/api/documents/${DOCUMENT_ID}/download`), {
      organizationId: 'org-1',
      userId: 'user-1',
    }, { id: DOCUMENT_ID });

    expect(res.status).toBe(200);
    const body = await res.json();
    const url = new URL(body.data.downloadUrl, 'https://example.com');
    expect(url.origin).toBe('https://example.com');
    expect(url.pathname).toBe(`/api/documents/${DOCUMENT_ID}/content`);
    const lease = verifyDocumentDownloadLease(url.searchParams.get('lease')!, { organizationId: 'org-1', userId: 'user-1', documentId: DOCUMENT_ID });
    expect(lease.versionId).toBe(VERSION_ID);
    expect(lease.expiresAt - lease.issuedAt).toBe(DOCUMENT_DOWNLOAD_LEASE_MS);
    expect(JSON.stringify(body)).not.toContain('https://old');
    expect(mocks.generateSasUrl).not.toHaveBeenCalled();
    expect(mocks.persistAtomicAudit).toHaveBeenCalledTimes(1);
    expect(mocks.persistAtomicAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'document.download', resourceId: DOCUMENT_ID }),
    );
  });

  it('rejects a malformed document id before querying storage', async () => {
    const res = await GET(new Request('https://example.com/api/documents/doc-1/download'), {
      organizationId: 'org-1',
      userId: 'user-1',
    }, { id: 'doc-1' });

    expect(res.status).toBe(400);
    expect(mocks.db.select).not.toHaveBeenCalled();
    expect(mocks.generateSasUrl).not.toHaveBeenCalled();
  });

  it('does not issue a link when signing configuration is unavailable', async () => {
    mocks.db._selectQueue.push(
      [{
        id: DOCUMENT_ID,
        title: 'A',
        name: 'A',
        filename: 'a.pdf',
        fileUrl: 'https://old',
        mimeType: 'application/pdf',
        privacyLabel: 'team_confidential',
        linkedEntityType: null,
        linkedEntityId: null,
      }],
      [],
      [{ ...VERSION }],
    );
    mocks.isDocumentVisibleByPolicy.mockReturnValue(true);
    delete process.env.EVIDENCE_SEAL_KEY;

    const res = await GET(new Request(`https://example.com/api/documents/${DOCUMENT_ID}/download`), {
      organizationId: 'org-1',
      userId: 'user-1',
    }, { id: DOCUMENT_ID });
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(JSON.stringify(body)).not.toContain('https://');
    expect(mocks.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('does not issue a url when the mandatory audit write throws', async () => {
    mocks.db._selectQueue.push(
      [{
        id: DOCUMENT_ID,
        title: 'A',
        name: 'A',
        filename: 'a.pdf',
        fileUrl: 'https://old',
        mimeType: 'application/pdf',
        privacyLabel: 'team_confidential',
        linkedEntityType: null,
        linkedEntityId: null,
      }],
      [],
      [{ ...VERSION }],
    );
    mocks.isDocumentVisibleByPolicy.mockReturnValue(true);
    mocks.persistAtomicAudit.mockRejectedValue(new Error('audit down'));

    const res = await GET(new Request(`https://example.com/api/documents/${DOCUMENT_ID}/download`), {
      organizationId: 'org-1',
      userId: 'user-1',
    }, { id: DOCUMENT_ID });
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(JSON.stringify(body)).not.toContain('lease=');
  });

  it('records no canonical access audit for a policy denial', async () => {
    mocks.db._selectQueue.push(
      [{
        id: DOCUMENT_ID,
        title: 'A',
        name: 'A',
        filename: 'a.pdf',
        fileUrl: 'https://old',
        mimeType: 'application/pdf',
        privacyLabel: 'team_confidential',
        linkedEntityType: null,
        linkedEntityId: null,
      }],
      [],
      [{ ...VERSION }],
    );
    mocks.isDocumentVisibleByPolicy.mockReturnValue(false);

    const denied = await GET(new Request(`https://example.com/api/documents/${DOCUMENT_ID}/download`), {
      organizationId: 'org-1',
      userId: 'user-1',
    }, { id: DOCUMENT_ID });

    expect(denied.status).toBe(403);
    expect(mocks.persistAtomicAudit).not.toHaveBeenCalled();
  });
});
