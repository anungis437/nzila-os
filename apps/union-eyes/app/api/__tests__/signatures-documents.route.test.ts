import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApiAuth: vi.fn(),
  getCurrentUser: vi.fn(),
  createSignatureRequest: vi.fn(),
  getUserDocuments: vi.fn(),
  standardErrorResponse: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withApiAuth: m.withApiAuth, getCurrentUser: m.getCurrentUser }));
vi.mock('@/lib/signature/signature-service', () => ({
  SignatureService: {
    createSignatureRequest: m.createSignatureRequest,
    getUserDocuments: m.getUserDocuments,
  },
}));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { AUTH_REQUIRED: 'AUTH_REQUIRED', VALIDATION_ERROR: 'VALIDATION_ERROR', MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD', INTERNAL_ERROR: 'INTERNAL_ERROR' },
  standardErrorResponse: m.standardErrorResponse,
}));

async function loadRoute() {
  return import('../signatures/documents/route');
}

describe('signatures/documents route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApiAuth.mockImplementation((handler: any) => handler);
    m.getCurrentUser.mockResolvedValue({ id: 'u1' });
    m.createSignatureRequest.mockResolvedValue({ id: 'doc_1', title: 'Contract', status: 'draft', createdAt: '2026-01-01' });
    m.getUserDocuments.mockResolvedValue([{ id: 'doc_1' }]);
    m.standardErrorResponse.mockImplementation((code: string, message: string) =>
      new Response(JSON.stringify({ code, message }), { status: code === 'AUTH_REQUIRED' ? 401 : 400 }));
  });

  it('POST returns 401 when current user is missing', async () => {
    const { POST } = await loadRoute();
    m.getCurrentUser.mockResolvedValueOnce(null);

    const response = await POST(new NextRequest('http://localhost/api/signatures/documents', { method: 'POST', body: new FormData() }));
    expect(response.status).toBe(401);
  });

  it('POST validates required fields', async () => {
    const { POST } = await loadRoute();
    const form = new FormData();
    form.set('title', 'Doc');

    const response = await POST(new NextRequest('http://localhost/api/signatures/documents', { method: 'POST', body: form }));
    expect(response.status).toBe(400);
  });

  it('POST rejects invalid signers JSON', async () => {
    const { POST } = await loadRoute();
    const form = new FormData();
    form.set('file', new File(['x'], 'a.txt'));
    form.set('title', 'Doc');
    form.set('organizationId', 'org_1');
    form.set('signers', 'not-json');

    const response = await POST(new NextRequest('http://localhost/api/signatures/documents', { method: 'POST', body: form }));
    expect(response.status).toBe(400);
  });

  it('POST creates a signature request', async () => {
    const { POST } = await loadRoute();
    const form = new FormData();
    form.set('file', new File(['abc'], 'contract.pdf'));
    form.set('title', 'Contract');
    form.set('organizationId', 'org_1');
    form.set('signers', JSON.stringify([{ email: 'x@y.com' }]));

    const response = await POST(new NextRequest('http://localhost/api/signatures/documents', { method: 'POST', body: form }));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
  });

  it('GET validates organizationId query param', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/signatures/documents'));
    expect(response.status).toBe(400);
  });

  it('GET returns user documents', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/signatures/documents?organizationId=org_1'));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toHaveLength(1);
  });
});
