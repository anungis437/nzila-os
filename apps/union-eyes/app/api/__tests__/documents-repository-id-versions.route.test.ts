import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { caller, declared, resetCaller } from './support/with-api-stub';

const DOC = '11111111-1111-4111-8111-111111111111';

const m = vi.hoisted(() => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
  withRLSContext: vi.fn(),
  persistAtomicAudit: vi.fn(),
  getEffectiveCaseAccess: vi.fn(),
  resolveStoredBlob: vi.fn(),
  getDocumentMutabilityBlockReason: vi.fn(),
}));

vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule);
// The ambient handle must never be reached by this route: a statement on it would run outside the organization's transaction.
const ambient = new Proxy({}, { get: () => { throw new Error('the ambient database handle was used'); } });
vi.mock('@/db/db', () => ({ db: ambient }));
vi.mock('@/db', () => ({ db: ambient }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/lib/services/case-access-service', () => ({ getEffectiveCaseAccess: m.getEffectiveCaseAccess }));
vi.mock('@/db/schema/documents-schema', () => ({
  documents: { id: 'id', organizationId: 'organizationId', metadata: 'metadata', fileUrl: 'fileUrl', updatedAt: 'updatedAt', uploadedBy: 'uploadedBy', deletedAt: 'deletedAt' },
  documentLinks: { documentId: 'documentId', linkedEntityType: 'linkedEntityType', linkedEntityId: 'linkedEntityId' },
  documentVersions: { id: 'id', versionNo: 'versionNo', organizationId: 'organizationId', documentId: 'documentId', storageKey: 'storageKey', contentHash: 'contentHash', uploadedBy: 'uploadedBy' },
}));
vi.mock('@/lib/services/document-blob-integrity-service', () => ({
  resolveStoredBlob: m.resolveStoredBlob,
  storedBlobFailure: (error: { code?: string; message?: string }) => ({
    status: error?.code === 'CONTENT_HASH_MISMATCH' ? 'conflict' : 'validation',
    message: error?.message ?? 'Invalid storage payload',
  }),
}));
vi.mock('@/lib/services/document-retention-guard', () => ({ getDocumentMutabilityBlockReason: m.getDocumentMutabilityBlockReason }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, and: vi.fn(() => 'and'), eq: vi.fn(() => 'eq'), desc: vi.fn(() => 'desc'), sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../documents/repository/[id]/versions/route');
}

describe('documents/repository/[id]/versions route', () => {
  // Select order: the authorizing read, then inside the transaction the row lock, the latest version, the blob-in-use check.
  const selectDocument = (row: Record<string, unknown>, opts: { latest?: number; inUse?: boolean; locked?: boolean } = {}) => {
    m.db.select
      .mockReset()
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ leftJoin: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => [row]) })) })) })) }))
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ for: vi.fn(async () => (opts.locked === false ? [] : [{ metadata: {} }])) })) })) }))
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn(() => ({ limit: vi.fn(async () => [{ versionNo: opts.latest ?? 1 }]) })) })) })) }))
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => (opts.inUse ? [{ id: 'other' }] : [])) })) })) }));
  };
  const post = async (body: Record<string, unknown> = { blobPath: 'blob-1' }, id: string = DOC) => {
    const { POST } = await loadRoute();
    return POST(
      new NextRequest(`http://localhost/api/documents/repository/${id}/versions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
      { params: { id } },
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetCaller();
    caller.userId = 'u1';
    caller.organizationId = 'org_1';
    caller.role = 'member';
    m.withRLSContext.mockImplementation(async (_context: unknown, fn: (tx: unknown) => unknown) => fn(m.db));
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.getEffectiveCaseAccess.mockResolvedValue({ canModifyDocuments: false });
    m.resolveStoredBlob.mockResolvedValue({ blobPath: 'blob-1', contentHash: 'hash-1', fileUrl: 'https://example.com/file.pdf' });
    m.getDocumentMutabilityBlockReason.mockReturnValue(null);
    selectDocument({ id: 'doc_1', metadata: {}, uploadedBy: 'u1', linkedEntityType: null, linkedEntityId: null });
    m.db.insert.mockReturnValue({ values: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'ver_2' }]) })) });
    m.db.update.mockReturnValue({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) });
  });

  it('declares no role floor (the document\'s uploader or the case kernel decides) and the case-suite entitlement', async () => {
    await loadRoute();
    expect(declared.at(-1)?.auth?.minRole).toBeUndefined();
    expect(declared.at(-1)?.entitlement).toBe('grievance_case_suite');
  });

  it('answers a malformed document id as a bad request, before storage or the database', async () => {
    const response = await post({ blobPath: 'blob-1' }, 'doc_1');
    expect(response.status).toBe(400);
    expect(m.resolveStoredBlob).not.toHaveBeenCalled();
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });

  it('lets the uploader append a new version, audited in the same transaction', async () => {
    const response = await post();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toEqual({ id: 'ver_2' });
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(m.db, expect.objectContaining({ action: 'document.version_append', organizationId: 'org_1', userId: 'u1', resourceId: DOC }));
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

  describe('server-verified storage, hash and version state', () => {
    const hash = 'a'.repeat(64);

    it('passes a claimed content hash to the verifier instead of trusting it', async () => {
      const response = await post({ blobPath: 'blob-1', contentHash: hash });
      expect(response.status).toBe(200);
      expect(m.resolveStoredBlob).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org_1', expectedContentHash: hash }));
    });

    it('answers 409 and writes nothing when the claimed hash does not match the stored file', async () => {
      m.resolveStoredBlob.mockRejectedValueOnce(Object.assign(new Error('The content hash does not match the stored file'), { code: 'CONTENT_HASH_MISMATCH' }));
      const response = await post({ blobPath: 'blob-1', contentHash: hash });
      expect(response.status).toBe(409);
      expect(m.db.insert).not.toHaveBeenCalled();
      expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    });

    it('answers 400 for an external or foreign storage reference and writes nothing', async () => {
      m.resolveStoredBlob.mockRejectedValueOnce(Object.assign(new Error('The file URL does not point at the organization document storage'), { code: 'INVALID_REFERENCE' }));
      const response = await post({ fileUrl: 'https://evil.example/documents/org_1/x.pdf' });
      expect(response.status).toBe(400);
      expect(m.db.insert).not.toHaveBeenCalled();
    });

    it('rejects a malformed hash and unknown fields before touching storage', async () => {
      expect((await post({ blobPath: 'blob-1', contentHash: 'manual:123' })).status).toBe(400);
      expect((await post({ blobPath: 'blob-1', organizationId: 'org_2' })).status).toBe(400);
      expect(m.resolveStoredBlob).not.toHaveBeenCalled();
    });

    it('answers 409 for a stale update and appends nothing', async () => {
      selectDocument({ id: 'doc_1', metadata: {}, uploadedBy: 'u1', linkedEntityType: null, linkedEntityId: null }, { latest: 3 });
      const response = await post({ blobPath: 'blob-1', expectedVersionNo: 2 });
      expect(response.status).toBe(409);
      expect(m.db.insert).not.toHaveBeenCalled();
      expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    });

    it('accepts an update made from the current version', async () => {
      selectDocument({ id: 'doc_1', metadata: {}, uploadedBy: 'u1', linkedEntityType: null, linkedEntityId: null }, { latest: 3 });
      expect((await post({ blobPath: 'blob-1', expectedVersionNo: 3 })).status).toBe(200);
    });

    it('answers 409 when the stored file is already attached to a document version', async () => {
      selectDocument({ id: 'doc_1', metadata: {}, uploadedBy: 'u1', linkedEntityType: null, linkedEntityId: null }, { inUse: true });
      const response = await post();
      expect(response.status).toBe(409);
      expect(m.db.insert).not.toHaveBeenCalled();
    });

    it('answers 404 when the document is deleted between authorization and the locked write', async () => {
      selectDocument({ id: 'doc_1', metadata: {}, uploadedBy: 'u1', linkedEntityType: null, linkedEntityId: null }, { locked: false });
      expect((await post()).status).toBe(404);
      expect(m.db.insert).not.toHaveBeenCalled();
    });
  });
});
