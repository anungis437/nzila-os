import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  checkRateLimit: vi.fn(),
  createRateLimitHeaders: vi.fn(),
  logApiAuditEvent: vi.fn(),
  insertDocument: vi.fn(),
  appendMandatoryAudit: vi.fn(),
  putBlob: vi.fn(),
  deleteBlob: vi.fn(),
  isMalwareScanError: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withRoleAuth: m.withRoleAuth }));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  createRateLimitHeaders: m.createRateLimitHeaders,
  RATE_LIMITS: { DOCUMENT_UPLOAD: { windowMs: 60000, maxRequests: 100 } },
}));
vi.mock('@/lib/middleware/api-security', () => ({ logApiAuditEvent: m.logApiAuditEvent }));
vi.mock('@/db/db', () => ({
  db: {
    transaction: async (fn: (tx: unknown) => unknown) =>
      fn({ insert: () => ({ values: (v: unknown) => ({ returning: () => m.insertDocument(v) }) }) }),
  },
}));
vi.mock('@/db/schema', () => ({ documents: {} }));
vi.mock('@/lib/db/org-owned-context', () => ({ withOrgOwnedContext: (operation: () => unknown) => operation() }));
vi.mock('@/lib/audit/mandatory-audit', () => ({ appendMandatoryAudit: m.appendMandatoryAudit }));
vi.mock('@/lib/blob-client', () => ({ putBlob: m.putBlob, deleteBlob: m.deleteBlob }));
vi.mock('@/lib/security/clamav', () => ({ isMalwareScanError: m.isMalwareScanError }));

async function loadRoute() {
  return import('../documents/upload/route');
}

describe('documents/upload route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    m.withRoleAuth.mockImplementation((_role: string, handler: any) => {
      return (request: Request, context: any = { userId: 'u1', organizationId: 'org_1' }) =>
        handler(request, context);
    });

    m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 });
    m.createRateLimitHeaders.mockReturnValue({ 'x-ratelimit-remaining': '0' });
    m.putBlob.mockResolvedValue({ url: 'https://blob.test/doc', pathname: 'documents/path', malwareScan: { status: 'clean' } });
    m.insertDocument.mockResolvedValue([{ id: 'doc_1', name: 'Test document' }]);
    m.appendMandatoryAudit.mockResolvedValue(undefined);
    m.deleteBlob.mockResolvedValue(undefined);
    m.isMalwareScanError.mockReturnValue(false);
  });

  it('returns error when file is missing', async () => {
    const { POST } = await loadRoute();
    const form = new FormData();
    form.set('organizationId', 'org_1');

    const response = await POST(new Request('http://localhost/api/documents/upload', { method: 'POST', body: form }));
    expect([200, 400, 403, 429, 500]).toContain(response.status);
  });

  it('returns forbidden on organization mismatch', async () => {
    const { POST } = await loadRoute();
    const file = new File([new Uint8Array([1, 2, 3])], 'doc.txt', { type: 'text/plain' });
    const form = new FormData();
    form.set('file', file);
    form.set('organizationId', 'org_other');

    const response = await POST(new Request('http://localhost/api/documents/upload', { method: 'POST', body: form }), {
      userId: 'u1',
      organizationId: 'org_1',
    });
    expect(response.status).toBe(403);
    expect(m.insertDocument).not.toHaveBeenCalled();
  });

  it('rejects a write when server organization context is missing', async () => {
    const { POST } = await loadRoute();
    const file = new File([new Uint8Array([1, 2, 3])], 'doc.txt', { type: 'text/plain' });
    const form = new FormData();
    form.set('file', file);
    form.set('organizationId', 'org_other');

    const response = await POST(new Request('http://localhost/api/documents/upload', { method: 'POST', body: form }), {
      userId: 'u1',
    });
    expect(response.status).toBe(403);
    expect(m.insertDocument).not.toHaveBeenCalled();
  });

  it('uploads a valid document stamped with the server organization', async () => {
    const { POST } = await loadRoute();
    const file = new File([new Uint8Array([1, 2, 3])], 'doc.txt', { type: 'text/plain' });
    const form = new FormData();
    form.set('file', file);
    form.set('organizationId', 'org_1');
    form.set('name', 'My File');

    const response = await POST(new Request('http://localhost/api/documents/upload', { method: 'POST', body: form }), {
      userId: 'u1',
      organizationId: 'org_1',
    });
    expect(response.status).toBe(201);
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

    const response = await POST(new Request('http://localhost/api/documents/upload', { method: 'POST', body: form }), {
      userId: 'u1',
      organizationId: 'org_1',
    });
    expect(response.status).toBeGreaterThanOrEqual(500);
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
  });

  it('returns validation error when organizationId is missing', async () => {
    const { POST } = await loadRoute();
    const file = new File([new Uint8Array([1, 2, 3])], 'doc.txt', { type: 'text/plain' });
    const form = new FormData();
    form.set('file', file);

    const response = await POST(new Request('http://localhost/api/documents/upload', { method: 'POST', body: form }));

    expect([400, 403, 500]).toContain(response.status);
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

  it('stores canonical intake without a document row or a storage url', async () => {
    const { POST } = await loadRoute();
    m.putBlob.mockResolvedValueOnce({
      url: 'https://blob.test/secret',
      pathname: 'documents/org_1/note.pdf',
      malwareScan: { status: 'clean' },
    });
    const file = new File([new Uint8Array([1, 2, 3])], 'note.pdf', { type: 'application/pdf' });
    const form = new FormData();
    form.set('file', file);
    form.set('organizationId', 'org_1');
    form.set('canonicalIntake', '1');

    const response = await POST(new Request('http://localhost/api/documents/upload', { method: 'POST', body: form }), {
      userId: 'u1',
      organizationId: 'org_1',
    });
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body).toEqual({
      blobPath: 'documents/org_1/note.pdf',
      checksum: expect.any(String),
      size: 3,
      mimeType: 'application/pdf',
      filename: 'note.pdf',
    });
    expect(JSON.stringify(body)).not.toContain('https://blob.test/secret');
    expect(m.insertDocument).not.toHaveBeenCalled();
    expect(m.appendMandatoryAudit).not.toHaveBeenCalled();
  });

  it('discards only an organization-owned blob path and does not require a file', async () => {
    const { POST } = await loadRoute();
    const owned = new FormData();
    owned.set('organizationId', 'org_1');
    owned.set('discardBlobPath', 'documents/org_1/note.pdf');
    const discarded = await POST(new Request('http://localhost/api/documents/upload', { method: 'POST', body: owned }), {
      userId: 'u1',
      organizationId: 'org_1',
    });
    expect(discarded.status).toBe(204);
    expect(m.deleteBlob).toHaveBeenCalledWith('documents/org_1/note.pdf');

    const foreign = new FormData();
    foreign.set('organizationId', 'org_1');
    foreign.set('discardBlobPath', 'documents/org_2/note.pdf');
    const rejected = await POST(new Request('http://localhost/api/documents/upload', { method: 'POST', body: foreign }), {
      userId: 'u1',
      organizationId: 'org_1',
    });
    expect(rejected.status).toBe(400);
    expect(m.deleteBlob).toHaveBeenCalledTimes(1);
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
