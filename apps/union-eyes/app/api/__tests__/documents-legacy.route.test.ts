import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const TEST_USER = {
  id: 'user_test_001',
  organizationId: '00000000-0000-0000-0000-000000000001',
};

const m = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  listDocuments: vi.fn(),
  createDocument: vi.fn(),
  searchDocuments: vi.fn(),
  getDocumentStatistics: vi.fn(),
  logApiAuditEvent: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({
  getCurrentUser: m.getCurrentUser,
  withRoleAuth: vi.fn(
    (_role: string, handler: (req: NextRequest, ctx: unknown) => Promise<Response>) =>
      (req: NextRequest, ctx: unknown = {}) => handler(req, ctx)
  ),
}));

vi.mock('@/lib/organization-middleware', () => ({
  withOrganizationAuth: vi.fn(
    (handler: (req: NextRequest, ctx: { organizationId: string; userId: string }) => Promise<Response>) =>
      (req: NextRequest) => handler(req, TEST_USER)
  ),
}));

vi.mock('@/lib/services/document-service', () => ({
  listDocuments: m.listDocuments,
  createDocument: m.createDocument,
  searchDocuments: m.searchDocuments,
  getDocumentStatistics: m.getDocumentStatistics,
}));

vi.mock('@/lib/middleware/api-security', () => ({
  logApiAuditEvent: m.logApiAuditEvent,
}));

async function loadRoute(flag = 'true') {
  vi.resetModules();
  process.env.LEGACY_DOCUMENT_API_ENABLED = flag;
  return import('../documents/route');
}

describe('documents legacy route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.getCurrentUser.mockResolvedValue(TEST_USER);
    m.listDocuments.mockResolvedValue({ documents: [{ id: 'doc-1' }], page: 1, total: 1 });
    m.searchDocuments.mockResolvedValue({ documents: [{ id: 'doc-search-1' }], total: 1 });
    m.getDocumentStatistics.mockResolvedValue({ totalDocuments: 10, byCategory: { policy: 4 } });
    m.createDocument.mockResolvedValue({ id: 'doc-created-1', name: 'Policy' });
  });

  it('returns NOT_IMPLEMENTED when legacy endpoint is disabled', async () => {
    const { GET } = await loadRoute('false');
    const response = await GET(new NextRequest('http://localhost/api/documents?organizationId=00000000-0000-0000-0000-000000000001'));

    expect(response.status).toBe(501);
    await expect(response.json()).resolves.toMatchObject({ code: 'NOT_IMPLEMENTED' });
  }, 60000);

  it('returns missing field when organizationId is not provided', async () => {
    const { GET } = await loadRoute('true');
    const response = await GET(new NextRequest('http://localhost/api/documents'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'MISSING_REQUIRED_FIELD' });
    expect(m.logApiAuditEvent).toHaveBeenCalled();
  });

  it('returns forbidden on organization mismatch', async () => {
    const { GET } = await loadRoute('true');
    const response = await GET(new NextRequest('http://localhost/api/documents?organizationId=00000000-0000-0000-0000-000000000999'));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('returns statistics mode payload', async () => {
    const { GET } = await loadRoute('true');
    const response = await GET(new NextRequest(`http://localhost/api/documents?organizationId=${TEST_USER.organizationId}&statistics=true`));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ totalDocuments: 10 });
    expect(m.getDocumentStatistics).toHaveBeenCalledWith(TEST_USER.organizationId);
  });

  it('returns advanced search results when search mode is enabled', async () => {
    const { GET } = await loadRoute('true');
    const response = await GET(new NextRequest(`http://localhost/api/documents?organizationId=${TEST_USER.organizationId}&search=true&searchQuery=policy&category=cba&tags=one,two&page=1&limit=25`));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.documents).toHaveLength(1);
    expect(m.searchDocuments).toHaveBeenCalledWith(
      TEST_USER.organizationId,
      'policy',
      expect.objectContaining({ category: 'cba', tags: ['one', 'two'] }),
      { page: 1, limit: 25 },
    );
  });

  it('returns paginated list results in default mode', async () => {
    const { GET } = await loadRoute('true');
    const response = await GET(new NextRequest(`http://localhost/api/documents?organizationId=${TEST_USER.organizationId}&page=2&limit=10&sortBy=name&sortOrder=asc&fileType=pdf`));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ documents: [{ id: 'doc-1' }] });
    expect(m.listDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: TEST_USER.organizationId, fileType: 'pdf' }),
      { page: 2, limit: 10, sortBy: 'name', sortOrder: 'asc' },
    );
  });

  it('returns validation error when POST body is not valid JSON', async () => {
    const { POST } = await loadRoute('true');
    const response = await POST(new NextRequest('http://localhost/api/documents', {
      method: 'POST',
      body: '{bad-json',
      headers: { 'content-type': 'application/json' },
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('returns forbidden when POST organizationId does not match auth context', async () => {
    const { POST } = await loadRoute('true');
    const response = await POST(new NextRequest('http://localhost/api/documents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organizationId: '00000000-0000-0000-0000-000000000999',
        name: 'Policy Pack',
        fileUrl: 'https://example.com/policy.pdf',
        fileType: 'pdf',
      }),
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('creates documents successfully on valid POST payload', async () => {
    const { POST } = await loadRoute('true');
    const response = await POST(new NextRequest('http://localhost/api/documents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organizationId: TEST_USER.organizationId,
        folderId: null,
        name: 'Policy Pack',
        fileUrl: 'https://example.com/policy.pdf',
        fileType: 'pdf',
        mimeType: 'application/pdf',
        metadata: { source: 'test' },
      }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload).toMatchObject({ id: 'doc-created-1' });
    expect(m.createDocument).toHaveBeenCalled();
  });
});