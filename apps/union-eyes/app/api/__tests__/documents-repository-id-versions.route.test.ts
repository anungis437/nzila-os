import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withOrganizationAuth: vi.fn(),
  requireEntitlement: vi.fn(),
  hasMinRole: vi.fn(),
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
  resolveStoredBlob: vi.fn(),
  getDocumentMutabilityBlockReason: vi.fn(),
}));

vi.mock('@/lib/organization-middleware', () => ({ withOrganizationAuth: m.withOrganizationAuth }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/db/schema/documents-schema', () => ({ documents: { id: 'id', organizationId: 'organizationId', metadata: 'metadata', fileUrl: 'fileUrl', updatedAt: 'updatedAt' }, documentVersions: { versionNo: 'versionNo', organizationId: 'organizationId', documentId: 'documentId', storageKey: 'storageKey', contentHash: 'contentHash', uploadedBy: 'uploadedBy' } }));
vi.mock('@/lib/services/document-blob-integrity-service', () => ({ resolveStoredBlob: m.resolveStoredBlob }));
vi.mock('@/lib/services/document-retention-guard', () => ({ getDocumentMutabilityBlockReason: m.getDocumentMutabilityBlockReason }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, and: vi.fn(() => 'and'), eq: vi.fn(() => 'eq'), desc: vi.fn(() => 'desc'), sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../documents/repository/[id]/versions/route');
}

describe('documents/repository/[id]/versions route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withOrganizationAuth.mockImplementation((handler: (request: Request, context: any, params?: { id: string }) => Promise<unknown>) =>
      (request: Request, context: any, params?: { id: string }) => handler(request, context, params));
    m.requireEntitlement.mockResolvedValue(undefined);
    m.hasMinRole.mockResolvedValue(true);
    m.resolveStoredBlob.mockResolvedValue({ blobPath: 'blob-1', contentHash: 'hash-1', fileUrl: 'https://example.com/file.pdf' });
    m.getDocumentMutabilityBlockReason.mockReturnValue(null);
    m.db.select
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => [{ id: 'doc_1', metadata: {} }]) })) })) }))
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn(() => ({ limit: vi.fn(async () => [{ versionNo: 1 }]) })) })) })) }));
    m.db.insert.mockReturnValue({ values: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'ver_2' }]) })) });
    m.db.update.mockReturnValue({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) });
  });

  it('appends a new document version', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new NextRequest('http://localhost/api/documents/repository/doc_1/versions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ blobPath: 'blob-1' }),
      }),
      { organizationId: 'org_1', userId: 'u1' },
      { id: 'doc_1' },
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toEqual({ id: 'ver_2' });
  });
});