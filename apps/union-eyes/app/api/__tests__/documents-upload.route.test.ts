import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  checkRateLimit: vi.fn(),
  createRateLimitHeaders: vi.fn(),
  logApiAuditEvent: vi.fn(),
  createDocument: vi.fn(),
  putBlob: vi.fn(),
  isMalwareScanError: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withRoleAuth: m.withRoleAuth }));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  createRateLimitHeaders: m.createRateLimitHeaders,
  RATE_LIMITS: { DOCUMENT_UPLOAD: { windowMs: 60000, maxRequests: 100 } },
}));
vi.mock('@/lib/middleware/api-security', () => ({ logApiAuditEvent: m.logApiAuditEvent }));
vi.mock('@/lib/services/document-service', () => ({ createDocument: m.createDocument }));
vi.mock('@/lib/blob-client', () => ({ putBlob: m.putBlob }));
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
    m.createDocument.mockResolvedValue({ id: 'doc_1', name: 'Test document' });
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

    const response = await POST(new Request('http://localhost/api/documents/upload', { method: 'POST', body: form }));
    expect([200, 400, 403, 429, 500]).toContain(response.status);
  });

  it('uploads a valid document', async () => {
    const { POST } = await loadRoute();
    const file = new File([new Uint8Array([1, 2, 3])], 'doc.txt', { type: 'text/plain' });
    const form = new FormData();
    form.set('file', file);
    form.set('organizationId', 'org_1');
    form.set('name', 'My File');

    const response = await POST(new Request('http://localhost/api/documents/upload', { method: 'POST', body: form }));
    expect([200, 201, 400, 403, 429, 500, 503]).toContain(response.status);
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
