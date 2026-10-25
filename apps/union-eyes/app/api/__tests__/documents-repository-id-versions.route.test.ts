import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withOrganizationAuth: vi.fn(),
  requireEntitlement: vi.fn(),
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
  withRLSContext: vi.fn(),
  persistAtomicAudit: vi.fn(),
  getEffectiveCaseAccess: vi.fn(),
  resolveStoredBlob: vi.fn(),
  getDocumentMutabilityBlockReason: vi.fn(),
}));

vi.mock('@/lib/organization-middleware', () => ({ withOrganizationAuth: m.withOrganizationAuth }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/lib/services/case-access-service', () => ({ getEffectiveCaseAccess: m.getEffectiveCaseAccess }));
vi.mock('@/db/schema/documents-schema', () => ({
  documents: { id: 'id', organizationId: 'organizationId', metadata: 'metadata', fileUrl: 'fileUrl', updatedAt: 'updatedAt', uploadedBy: 'uploadedBy' },
  documentLinks: { documentId: 'documentId', linkedEntityType: 'linkedEntityType', linkedEntityId: 'linkedEntityId' },
  documentVersions: { versionNo: 'versionNo', organizationId: 'organizationId', documentId: 'documentId', storageKey: 'storageKey', contentHash: 'contentHash', uploadedBy: 'uploadedBy' },
}));
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
  const selectDocument = (row: Record<string, unknown>) => {
    m.db.select
      .mockReset()
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ leftJoin: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => [row]) })) })) })) }))
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn(() => ({ limit: vi.fn(async () => [{ versionNo: 1 }]) })) })) })) }));
  };
  const post = async () => {
    const { POST } = await loadRoute();
    return POST(
      new NextRequest('http://localhost/api/documents/repository/doc_1/versions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ blobPath: 'blob-1' }),
      }),
      { organizationId: 'org_1', userId: 'u1' },
      { id: 'doc_1' },
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    m.withOrganizationAuth.mockImplementation((handler: (request: Request, context: any, params?: { id: string }) => Promise<unknown>) =>
      (request: Request, context: any, params?: { id: string }) => handler(request, context, params));
    m.requireEntitlement.mockResolvedValue(undefined);
    m.withRLSContext.mockImplementation(async (_context: unknown, fn: (tx: unknown) => unknown) => fn(m.db));
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.getEffectiveCaseAccess.mockResolvedValue({ canModifyDocuments: false });
    m.resolveStoredBlob.mockResolvedValue({ blobPath: 'blob-1', contentHash: 'hash-1', fileUrl: 'https://example.com/file.pdf' });
    m.getDocumentMutabilityBlockReason.mockReturnValue(null);
    selectDocument({ id: 'doc_1', metadata: {}, uploadedBy: 'u1', linkedEntityType: null, linkedEntityId: null });
    m.db.insert.mockReturnValue({ values: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'ver_2' }]) })) });
    m.db.update.mockReturnValue({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) });
  });

  it('lets the uploader append a new version, audited in the same transaction', async () => {
    const response = await post();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toEqual({ id: 'ver_2' });
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(m.db, expect.objectContaining({ action: 'document.version_append', organizationId: 'org_1', userId: 'u1', resourceId: 'doc_1' }));
  });

  it('answers 404 and writes nothing for another member\'s unlinked document', async () => {
    selectDocument({ id: 'doc_1', metadata: {}, uploadedBy: 'someone-else', linkedEntityType: null, linkedEntityId: null });
    const response = await post();
    expect(response.status).toBe(404);
    expect(m.db.insert).not.toHaveBeenCalled();
    expect(m.db.update).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('lets someone the kernel allows to modify documents on the linked grievance append a version', async () => {
    selectDocument({ id: 'doc_1', metadata: {}, uploadedBy: 'someone-else', linkedEntityType: 'grievance', linkedEntityId: 'g1' });
    m.getEffectiveCaseAccess.mockResolvedValueOnce({ canModifyDocuments: true });
    const response = await post();
    expect(response.status).toBe(200);
    expect(m.getEffectiveCaseAccess).toHaveBeenCalledWith({ organizationId: 'org_1', grievanceId: 'g1', userId: 'u1' });
  });

  it('answers 404 and writes nothing for a linked grievance document even to its uploader when the kernel denies modification', async () => {
    selectDocument({ id: 'doc_1', metadata: {}, uploadedBy: 'u1', linkedEntityType: 'grievance', linkedEntityId: 'g1' });
    m.getEffectiveCaseAccess.mockResolvedValueOnce({ canModifyDocuments: false });
    const response = await post();
    expect(response.status).toBe(404);
    expect(m.db.insert).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });
});