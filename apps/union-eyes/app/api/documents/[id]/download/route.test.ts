import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    appendMandatoryAudit: vi.fn(async () => true),
  };
});

vi.mock('@/lib/organization-middleware', () => ({
  withOrganizationAuth: vi.fn((handler: (...args: any[]) => unknown) => handler),
}));

vi.mock('@/services/platform-economics/entitlement-guard', () => ({
  requireEntitlement: vi.fn(async () => undefined),
}));

vi.mock('@/lib/api-auth-guard', () => ({
  hasMinRole: mocks.hasMinRole,
}));

vi.mock('@/db/db', () => ({
  db: mocks.db,
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

vi.mock('@/lib/audit/mandatory-audit', () => ({
  appendMandatoryAudit: mocks.appendMandatoryAudit,
}));

const DOCUMENT_ID = '11111111-1111-4111-8111-111111111111';

const { GET } = await import('@/app/api/documents/[id]/download/route');

describe('GET /api/documents/[id]/download', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db._selectQueue.length = 0;
    mocks.hasMinRole.mockResolvedValueOnce(true).mockResolvedValue(false);
    mocks.getEffectiveCaseAccess.mockResolvedValue({
      isPrimaryOwner: false,
      canViewCase: true,
      canViewPrivateDocuments: false,
    });
    mocks.generateSasUrl.mockResolvedValue('https://storage/documents/org-1/file.pdf?sig=1');
    mocks.appendMandatoryAudit.mockResolvedValue(true);
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
      [{ storageKey: 'documents/org-1/file.pdf' }],
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
      [{ storageKey: 'documents/org-1/file.pdf' }],
    );
    mocks.isDocumentVisibleByPolicy.mockReturnValue(true);

    const res = await GET(new Request(`https://example.com/api/documents/${DOCUMENT_ID}/download`), {
      organizationId: 'org-1',
      userId: 'user-1',
    }, { id: DOCUMENT_ID });

    expect(res.status).toBe(403);
    expect(mocks.generateSasUrl).not.toHaveBeenCalled();
  });

  it('returns signed download url when access is allowed', async () => {
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
      [{ storageKey: 'documents/org-1/file.pdf' }],
    );
    mocks.isDocumentVisibleByPolicy.mockReturnValue(true);

    const res = await GET(new Request(`https://example.com/api/documents/${DOCUMENT_ID}/download`), {
      organizationId: 'org-1',
      userId: 'user-1',
    }, { id: DOCUMENT_ID });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.downloadUrl).toContain('https://storage/documents/org-1/file.pdf');
    expect(mocks.appendMandatoryAudit).toHaveBeenCalledWith(
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

  it('does not issue a url when storage fails', async () => {
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
      [{ storageKey: 'documents/org-1/file.pdf' }],
    );
    mocks.isDocumentVisibleByPolicy.mockReturnValue(true);
    mocks.generateSasUrl.mockRejectedValue(new Error('blob unavailable'));

    const res = await GET(new Request(`https://example.com/api/documents/${DOCUMENT_ID}/download`), {
      organizationId: 'org-1',
      userId: 'user-1',
    }, { id: DOCUMENT_ID });
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(JSON.stringify(body)).not.toContain('https://');
    expect(mocks.appendMandatoryAudit).not.toHaveBeenCalled();
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
      [{ storageKey: 'documents/org-1/file.pdf' }],
    );
    mocks.isDocumentVisibleByPolicy.mockReturnValue(true);
    mocks.appendMandatoryAudit.mockRejectedValue(new Error('audit down'));

    const res = await GET(new Request(`https://example.com/api/documents/${DOCUMENT_ID}/download`), {
      organizationId: 'org-1',
      userId: 'user-1',
    }, { id: DOCUMENT_ID });
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(JSON.stringify(body)).not.toContain('https://storage');
  });

  it('still issues a url when canonical audit is disabled and the helper returns false', async () => {
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
      [{ storageKey: 'documents/org-1/file.pdf' }],
    );
    mocks.isDocumentVisibleByPolicy.mockReturnValue(true);
    mocks.appendMandatoryAudit.mockResolvedValue(false);

    const res = await GET(new Request(`https://example.com/api/documents/${DOCUMENT_ID}/download`), {
      organizationId: 'org-1',
      userId: 'user-1',
    }, { id: DOCUMENT_ID });

    expect(res.status).toBe(200);
  });
});
