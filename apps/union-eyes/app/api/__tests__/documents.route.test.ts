import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  listDocuments: vi.fn(),
  createDocument: vi.fn(),
  searchDocuments: vi.fn(),
  getDocumentStatistics: vi.fn(),
  logApiAuditEvent: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({
  withRoleAuth: vi.fn((_: string, handler: (req: NextRequest, ctx: any) => Promise<Response>) => (req: NextRequest, ctx: any = {}) => handler(req, ctx)),
  getCurrentUser: m.getCurrentUser,
}));
vi.mock('@/lib/services/document-service', () => ({
  listDocuments: m.listDocuments,
  createDocument: m.createDocument,
  searchDocuments: m.searchDocuments,
  getDocumentStatistics: m.getDocumentStatistics,
}));
vi.mock('@/lib/middleware/api-security', () => ({ logApiAuditEvent: m.logApiAuditEvent }));

async function loadRoute() {
  vi.resetModules();
  process.env.LEGACY_DOCUMENT_API_ENABLED = 'true';
  return import('../documents/route');
}

describe('documents route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.getCurrentUser.mockResolvedValue({ id: 'u1', organizationId: '00000000-0000-0000-0000-000000000001' });
    m.listDocuments.mockResolvedValue({ documents: [{ id: 'd1' }], total: 1 });
    m.searchDocuments.mockResolvedValue({ documents: [{ id: 'd2' }], total: 1 });
    m.getDocumentStatistics.mockResolvedValue({ totalDocuments: 10 });
    m.createDocument.mockResolvedValue({ id: 'doc_new', name: 'Policy' });
    m.logApiAuditEvent.mockResolvedValue(undefined);
  });

  it('GET requires organizationId query param', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/documents'));
    expect(response.status).toBe(400);
  });

  it('GET blocks cross-organization access', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/documents?organizationId=00000000-0000-0000-0000-000000000999'));
    expect(response.status).toBe(403);
  });

  it('GET returns statistics mode payload', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/documents?organizationId=00000000-0000-0000-0000-000000000001&statistics=true'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.totalDocuments).toBe(10);
  });

  it('GET returns advanced search results when search=true', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/documents?organizationId=00000000-0000-0000-0000-000000000001&search=true&searchQuery=policy'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.documents).toHaveLength(1);
    expect(m.searchDocuments).toHaveBeenCalled();
  });

  it('POST returns validation error for invalid JSON body', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/documents', {
      method: 'POST',
      body: '{bad-json',
      headers: { 'content-type': 'application/json' },
    }));
    expect(response.status).toBe(400);
  });

  it('POST blocks mismatched organizationId', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/documents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organizationId: '00000000-0000-0000-0000-000000000999',
        name: 'Policy',
        fileUrl: 'https://example.com/policy.pdf',
        fileType: 'pdf',
      }),
    }));
    expect(response.status).toBe(403);
  });

  it('POST creates document on valid payload', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/documents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organizationId: '00000000-0000-0000-0000-000000000001',
        name: 'Policy',
        fileUrl: 'https://example.com/policy.pdf',
        fileType: 'pdf',
      }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.id).toBe('doc_new');
    expect(m.createDocument).toHaveBeenCalled();
  });
});
