import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  createRateLimitHeaders: vi.fn(),
  logApiAuditEvent: vi.fn(),
  insertDocument: vi.fn(),
  appendMandatoryAudit: vi.fn(),
  putBlob: vi.fn(),
  deleteBlob: vi.fn(),
  isMalwareScanError: vi.fn(),
  requireCaseFilingCapacity: vi.fn(),
  hasCaseFilingCapacity: vi.fn(),
  openIntake: vi.fn(),
  withRLSContext: vi.fn(),
}));

vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule);
vi.mock('@/lib/cases/case-authorization', () => ({ requireCaseFilingCapacity: m.requireCaseFilingCapacity, hasCaseFilingCapacity: m.hasCaseFilingCapacity }));

vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  createRateLimitHeaders: m.createRateLimitHeaders,
  RATE_LIMITS: { DOCUMENT_UPLOAD: { windowMs: 60000, maxRequests: 100 } },
}));
vi.mock('@/lib/middleware/api-security', () => ({ logApiAuditEvent: m.logApiAuditEvent }));
vi.mock('@/db/schema', () => ({ documents: {} }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.appendMandatoryAudit }));
vi.mock('@/lib/blob-client', () => ({ putBlob: m.putBlob, deleteBlob: m.deleteBlob }));
vi.mock('@/lib/security/clamav', () => ({ isMalwareScanError: m.isMalwareScanError }));
vi.mock('@/lib/documents/intake-lifecycle', () => ({ openIntake: m.openIntake }));
vi.mock('@/lib/documents/intake-storage', () => ({ blobIntakeStorage: {} }));

const { caller, declared, resetCaller } = await import('./support/with-api-stub');

async function loadRoute() {
  return import('../documents/upload/route');
}

describe('documents/upload route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCaller();
    caller.role = 'member';

    // The tenant transaction the document row and its audit record are written in.
    m.withRLSContext.mockImplementation(async (_scope: unknown, run: (tx: unknown) => unknown) =>
      run({ insert: () => ({ values: (v: unknown) => ({ returning: () => m.insertDocument(v) }) }) }));
    m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 });
    m.createRateLimitHeaders.mockReturnValue({ 'x-ratelimit-remaining': '0' });
    m.putBlob.mockResolvedValue({ url: 'https://blob.test/doc', pathname: 'documents/path', malwareScan: { status: 'clean' } });
    m.insertDocument.mockResolvedValue([{ id: 'doc_1', name: 'Test document' }]);
    m.appendMandatoryAudit.mockResolvedValue(undefined);
    m.deleteBlob.mockResolvedValue(undefined);
    m.isMalwareScanError.mockReturnValue(false);
    m.requireCaseFilingCapacity.mockResolvedValue(undefined);
    m.hasCaseFilingCapacity.mockResolvedValue(true);
  });

  it('declares what it asks of the wrapper: a member in an organization, and no transaction spanning the blob upload and the malware scan', async () => {
    await loadRoute();
    const config = declared.find((entry) => entry.openapi?.summary === 'Upload a document file');

    expect(config?.auth).toEqual({ minRole: 'member' });
    expect(config?.requireOrg).toBeUndefined();
    expect(config?.rlsOrgContext).toBeUndefined();
  });

  it('returns 400 when the file is missing, and stores nothing', async () => {
    const { POST } = await loadRoute();
    const form = new FormData();
    form.set('organizationId', 'org_1');

    const response = await POST(new Request('http://localhost/api/documents/upload', { method: 'POST', body: form }));
    expect(response.status).toBe(400);
    expect(m.putBlob).not.toHaveBeenCalled();
    expect(m.insertDocument).not.toHaveBeenCalled();
  });

  it('returns forbidden on organization mismatch', async () => {
    const { POST } = await loadRoute();
    const file = new File([new Uint8Array([1, 2, 3])], 'doc.txt', { type: 'text/plain' });
    const form = new FormData();
    form.set('file', file);
    form.set('organizationId', 'org_other');

    const response = await POST(new Request('http://localhost/api/documents/upload', { method: 'POST', body: form }));
    expect(response.status).toBe(403);
    expect(m.putBlob).not.toHaveBeenCalled();
    expect(m.insertDocument).not.toHaveBeenCalled();
  });

  it('rejects a write when server organization context is missing', async () => {
    caller.organizationId = null;
    const { POST } = await loadRoute();
    const file = new File([new Uint8Array([1, 2, 3])], 'doc.txt', { type: 'text/plain' });
    const form = new FormData();
    form.set('file', file);
    form.set('organizationId', 'org_other');

    const response = await POST(new Request('http://localhost/api/documents/upload', { method: 'POST', body: form }));
    expect(response.status).toBe(403);
    expect(m.hasCaseFilingCapacity).not.toHaveBeenCalled();
    expect(m.putBlob).not.toHaveBeenCalled();
    expect(m.insertDocument).not.toHaveBeenCalled();
  });

  it('uploads a valid document stamped with the server organization', async () => {
    const { POST } = await loadRoute();
    const file = new File([new Uint8Array([1, 2, 3])], 'doc.txt', { type: 'text/plain' });
    const form = new FormData();
    form.set('file', file);
    form.set('organizationId', 'org_1');
    form.set('name', 'My File');

    const response = await POST(new Request('http://localhost/api/documents/upload', { method: 'POST', body: form }));
    expect(response.status).toBe(201);
    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org_1' }, expect.any(Function));
    expect(m.insertDocument).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org_1' }));
    expect(m.appendMandatoryAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ organizationId: 'org_1', action: 'document.upload', resourceId: 'doc_1' }),
    );
  });

  it('removes the stored blob and fails when the mandatory audit write fails', async () => {
    const { POST } = await loadRoute();
    m.appendMandatoryAudit.mockRejectedValueOnce(new Error('audit unavailable'));
    const file = new File([new Uint8Array([1, 2, 3])], 'doc.txt', { type: 'text/plain' });
    const form = new FormData();
    form.set('file', file);
    form.set('organizationId', 'org_1');

    const response = await POST(new Request('http://localhost/api/documents/upload', { method: 'POST', body: form }));
    expect(response.status).toBeGreaterThanOrEqual(500);
    expect(m.deleteBlob).toHaveBeenCalledWith('https://blob.test/doc');
  });

  it('answers 403 before reading the form or storing any blob, and files and audits nothing, when member filing capacity is refused', async () => {
    const { POST } = await loadRoute();
    m.hasCaseFilingCapacity.mockResolvedValueOnce(false);
    const file = new File([new Uint8Array([1, 2, 3])], 'doc.txt', { type: 'text/plain' });
    const form = new FormData();
    form.set('file', file);
    form.set('organizationId', 'org_1');

    const response = await POST(new Request('http://localhost/api/documents/upload', { method: 'POST', body: form }));
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe('FORBIDDEN');
    expect(m.hasCaseFilingCapacity).toHaveBeenCalledWith({ userId: 'u1', organizationId: 'org_1' }, 'member');
    expect(m.putBlob).not.toHaveBeenCalled();
    expect(m.deleteBlob).not.toHaveBeenCalled();
    expect(m.insertDocument).not.toHaveBeenCalled();
    expect(m.appendMandatoryAudit).not.toHaveBeenCalled();
  });

  it('removes the stored blob and files nothing when the in-transaction capacity guard refuses', async () => {
    const { POST } = await loadRoute();
    const { ApiError } = await import('@/lib/api/errors');
    m.requireCaseFilingCapacity.mockRejectedValueOnce(ApiError.forbidden());
    const file = new File([new Uint8Array([1, 2, 3])], 'doc.txt', { type: 'text/plain' });
    const form = new FormData();
    form.set('file', file);
    form.set('organizationId', 'org_1');

    const response = await POST(new Request('http://localhost/api/documents/upload', { method: 'POST', body: form }));
    // The wrapper answers the refusal with its own status; it is not a server fault.
    expect(response.status).toBe(403);
    expect(m.requireCaseFilingCapacity).toHaveBeenCalledWith(expect.anything(), { userId: 'u1', organizationId: 'org_1' }, 'member');
    expect(m.insertDocument).not.toHaveBeenCalled();
    expect(m.appendMandatoryAudit).not.toHaveBeenCalled();
    expect(m.deleteBlob).toHaveBeenCalledWith('https://blob.test/doc');
  });
  it('returns 429 when rate-limited', async () => {
    const { POST } = await loadRoute();
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false, resetIn: 60 });
    const file = new File([new Uint8Array([1, 2, 3])], 'doc.txt', { type: 'text/plain' });
    const form = new FormData();
    form.set('file', file);
    form.set('organizationId', 'org_1');

    const response = await POST(new Request('http://localhost/api/documents/upload', { method: 'POST', body: form }));

    expect(response.status).toBe(429);
    expect(m.logApiAuditEvent).toHaveBeenCalled();
    expect(m.checkRateLimit).toHaveBeenCalledWith('doc-upload:u1', expect.anything());
    expect(m.putBlob).not.toHaveBeenCalled();
  });

  it('returns 400 when organizationId is missing from the form, and stores nothing', async () => {
    const { POST } = await loadRoute();
    const file = new File([new Uint8Array([1, 2, 3])], 'doc.txt', { type: 'text/plain' });
    const form = new FormData();
    form.set('file', file);

    const response = await POST(new Request('http://localhost/api/documents/upload', { method: 'POST', body: form }));

    expect(response.status).toBe(400);
    expect(m.putBlob).not.toHaveBeenCalled();
    expect(m.insertDocument).not.toHaveBeenCalled();
  });

  it('rejects file exceeding size limit', async () => {
    const { POST } = await loadRoute();
    const largeBuffer = new Uint8Array(51 * 1024 * 1024);
    const file = new File([largeBuffer], 'large.pdf', { type: 'application/pdf' });
    const form = new FormData();
    form.set('file', file);
    form.set('organizationId', 'org_1');

    const response = await POST(new Request('http://localhost/api/documents/upload', { method: 'POST', body: form }));

    expect(response.status).toBe(400);
  });

  it('opens a server-issued intake and returns its id, never a storage path or url', async () => {
    const { POST } = await loadRoute();
    m.openIntake.mockResolvedValueOnce({
      ok: true,
      intake: {
        intakeId: '11111111-1111-4111-8111-111111111111', status: 'open', operation: 'create_document', targetDocumentId: null,
        filename: 'note.pdf', mimeType: 'application/pdf', size: 3, checksum: 'a'.repeat(64),
        createdAt: '2026-01-01T00:00:00.000Z', expiresAt: '2026-01-01T00:30:00.000Z', acceptedDocumentId: null, acceptedVersionId: null,
      },
    });
    const file = new File([new Uint8Array([1, 2, 3])], 'note.pdf', { type: 'application/pdf' });
    const form = new FormData();
    form.set('file', file);
    form.set('organizationId', 'org_1');
    form.set('canonicalIntake', '1');

    const response = await POST(new Request('http://localhost/api/documents/upload', { method: 'POST', body: form }));
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body).toEqual({ success: true, data: expect.objectContaining({ intakeId: '11111111-1111-4111-8111-111111111111', size: 3, checksum: 'a'.repeat(64) }) });
    expect(JSON.stringify(body)).not.toMatch(/blobPath|storageKey|https?:\/\//);
    expect(m.openIntake).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org_1', userId: 'u1', operation: 'create_document', filename: 'note.pdf', mimeType: 'application/pdf' }),
      expect.anything(),
    );
    // The upload route stores nothing itself in this mode and writes no document.
    expect(m.putBlob).not.toHaveBeenCalled();
    expect(m.insertDocument).not.toHaveBeenCalled();
  });

  it('reports a refused or failed intake without leaking storage detail', async () => {
    const { POST } = await loadRoute();
    const send = async () => {
      const form = new FormData();
      form.set('file', new File([new Uint8Array([1])], 'note.pdf', { type: 'application/pdf' }));
      form.set('organizationId', 'org_1');
      form.set('canonicalIntake', '1');
      return POST(new Request('http://localhost/api/documents/upload', { method: 'POST', body: form }));
    };
    m.openIntake.mockResolvedValueOnce({ ok: false, kind: 'invalid' });
    expect((await send()).status).toBe(400);
    m.openIntake.mockResolvedValueOnce({ ok: false, kind: 'upload_failed', error: new Error('documents/org_1/secret failed') });
    const failed = await send();
    expect(failed.status).toBeGreaterThanOrEqual(500);
    expect(JSON.stringify(await failed.json())).not.toContain('documents/org_1/secret');
  });

  it('refuses client discard without deleting the supplied path', async () => {
    const { POST } = await loadRoute();
    m.deleteBlob.mockRejectedValue(new Error('cleanup failed'));
    const paths = [
      'documents/org_1/note.pdf',
      'documents/org_2/note.pdf',
      'documents/org_1/../org_2/note.pdf',
      'documents/org_1/accepted.pdf',
      'https://storage.example/documents/org_1/note.pdf',
    ];

    for (const blobPath of paths) {
      const form = new FormData();
      form.set('organizationId', 'org_1');
      form.set('discardBlobPath', blobPath);
      const response = await POST(new Request('http://localhost/api/documents/upload', { method: 'POST', body: form }));
      expect(response.status).toBe(403);
      expect(JSON.stringify(await response.json())).not.toContain(blobPath);
    }

    const replay = new FormData();
    replay.set('organizationId', 'org_1');
    replay.set('discardBlobPath', 'documents/org_1/note.pdf');
    caller.userId = 'other-user';
    const again = await POST(new Request('http://localhost/api/documents/upload', { method: 'POST', body: replay }));
    expect(again.status).toBe(403);
    caller.userId = 'u1';

    const raced = await Promise.all([0, 1].map(() => {
      const form = new FormData();
      form.set('organizationId', 'org_1');
      form.set('file', new File([new Uint8Array([1])], 'note.pdf', { type: 'application/pdf' }));
      form.set('discardBlobPath', 'documents/org_1/note.pdf');
      return POST(new Request('http://localhost/api/documents/upload', { method: 'POST', body: form }));
    }));
    expect(raced.map((response) => response.status)).toEqual([403, 403]);
    expect(m.deleteBlob).not.toHaveBeenCalled();
    expect(m.putBlob).not.toHaveBeenCalled();
    expect(m.insertDocument).not.toHaveBeenCalled();
  });

  it('rejects disallowed MIME types', async () => {
    const { POST } = await loadRoute();
    const file = new File([new Uint8Array([1, 2, 3])], 'script.exe', { type: 'application/x-msdownload' });
    const form = new FormData();
    form.set('file', file);
    form.set('organizationId', 'org_1');

    const response = await POST(new Request('http://localhost/api/documents/upload', { method: 'POST', body: form }));

    expect(response.status).toBe(400);
  });
});
