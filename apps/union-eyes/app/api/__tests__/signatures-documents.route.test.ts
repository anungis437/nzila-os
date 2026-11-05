import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApiAuth: vi.fn(),
  getCurrentUser: vi.fn(),
  hasMinRole: vi.fn(),
  createSignatureRequest: vi.fn(),
  getUserDocuments: vi.fn(),
  standardErrorResponse: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withApiAuth: m.withApiAuth, getCurrentUser: m.getCurrentUser, hasMinRole: m.hasMinRole }));
vi.mock('@/lib/signature/signature-service', () => ({
  SignatureAuthorityError: class SignatureAuthorityError extends Error {
    constructor(readonly code: 'FORBIDDEN' | 'CONFLICT', message: string) {
      super(message);
    }
  },
  SignatureService: {
    createSignatureRequest: m.createSignatureRequest,
    getUserDocuments: m.getUserDocuments,
  },
}));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { AUTH_REQUIRED: 'AUTH_REQUIRED', FORBIDDEN: 'FORBIDDEN', VALIDATION_ERROR: 'VALIDATION_ERROR', MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD', INTERNAL_ERROR: 'INTERNAL_ERROR' },
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
    m.hasMinRole.mockResolvedValue(true);
    m.createSignatureRequest.mockResolvedValue({ id: 'doc_1', title: 'Contract', status: 'draft', createdAt: '2026-01-01' });
    m.getUserDocuments.mockResolvedValue([{ id: 'doc_1' }]);
    m.standardErrorResponse.mockImplementation((code: string, message: string) =>
      new Response(JSON.stringify({ code, message }), { status: code === 'AUTH_REQUIRED' ? 401 : code === 'FORBIDDEN' ? 403 : 400 }));
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
    m.getCurrentUser.mockResolvedValue({ id: 'u1', organizationId: 'org_1' });
    const { POST } = await loadRoute();
    const form = new FormData();
    form.set('file', new File(['abc'], 'contract.pdf'));
    form.set('title', 'Contract');
    form.set('signers', JSON.stringify([{ email: 'x@y.com', name: 'X Y' }]));

    const response = await POST(new NextRequest('http://localhost/api/signatures/documents', { method: 'POST', body: form }));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
  });

  it('POST ignores a client-supplied organizationId and uses the authenticated user\'s org', async () => {
    m.getCurrentUser.mockResolvedValue({ id: 'u1', organizationId: 'org_1' });
    const { POST } = await loadRoute();
    const form = new FormData();
    form.set('file', new File(['abc'], 'contract.pdf'));
    form.set('title', 'Contract');
    form.set('organizationId', 'org_evil');
    form.set('signers', JSON.stringify([{ email: 'x@y.com', name: 'X Y' }]));

    const response = await POST(new NextRequest('http://localhost/api/signatures/documents', { method: 'POST', body: form }));
    expect(response.status).toBe(200);
    expect(m.createSignatureRequest).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org_1' }),
    );
  });

  it('POST rejects when the authenticated user has no organization context', async () => {
    m.getCurrentUser.mockResolvedValue({ id: 'u1', organizationId: null });
    const { POST } = await loadRoute();
    const form = new FormData();
    form.set('file', new File(['abc'], 'contract.pdf'));
    form.set('title', 'Contract');
    form.set('organizationId', 'org_1');
    form.set('signers', JSON.stringify([{ email: 'x@y.com', name: 'X Y' }]));

    const response = await POST(new NextRequest('http://localhost/api/signatures/documents', { method: 'POST', body: form }));
    expect(response.status).toBe(400);
  });

  // DEF-0B11-SOC-SIGNER-IDENTITY-IS-SENDER-TYPED-TEXT… and DEF-0B11-SOC-ANY-AUTHENTICATED-USER-SENDS-AN-UPLOADED-FILE…
  describe('who may send, and to whom', () => {
    const post = async (signers: unknown, file = new File(['abc'], 'contract.pdf')) => {
      m.getCurrentUser.mockResolvedValue({ id: 'u1', organizationId: 'org_1' });
      const { POST } = await loadRoute();
      const form = new FormData();
      form.set('file', file);
      form.set('title', 'Contract');
      form.set('signers', JSON.stringify(signers));
      return POST(new NextRequest('http://localhost/api/signatures/documents', { method: 'POST', body: form }));
    };

    it('refuses an ordinary member before reading the upload or creating anything', async () => {
      m.hasMinRole.mockResolvedValue(false);
      const response = await post([{ email: 'x@y.com', name: 'X Y' }]);
      expect(response.status).toBe(403);
      expect(m.hasMinRole).toHaveBeenCalledWith('steward');
      expect(m.createSignatureRequest).not.toHaveBeenCalled();
    });

    it.each([
      ['an empty list', []],
      ['a signer with no name', [{ email: 'x@y.com' }]],
      ['a malformed e-mail address', [{ email: 'not-an-email', name: 'X' }]],
      ['an unexpected field', [{ email: 'x@y.com', name: 'X', status: 'signed' }]],
      ['more than twenty signers', Array.from({ length: 21 }, (_, i) => ({ email: `s${i}@y.com`, name: `S${i}` }))],
    ])('rejects %s without creating a request', async (_label, signers) => {
      const response = await post(signers);
      expect(response.status).toBe(400);
      expect(m.createSignatureRequest).not.toHaveBeenCalled();
    });

    it('rejects an upload over the size bound', async () => {
      const big = new File([new Uint8Array(15 * 1024 * 1024 + 1)], 'big.pdf');
      const response = await post([{ email: 'x@y.com', name: 'X Y' }], big);
      expect(response.status).toBe(400);
      expect(m.createSignatureRequest).not.toHaveBeenCalled();
    });

    it('reports a refusal from the signer verification as the authority error it is', async () => {
      const { SignatureAuthorityError } = await import('@/lib/signature/signature-service');
      m.createSignatureRequest.mockRejectedValueOnce(new SignatureAuthorityError('FORBIDDEN', 'Every platform signer must be an active member of the organization'));
      const response = await post([{ userId: 'outsider', email: 'x@y.com', name: 'X Y' }]);
      expect(response.status).toBe(403);
    });
  });

  it('GET rejects when the authenticated user has no organization context', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/signatures/documents'));
    expect(response.status).toBe(400);
  });

  it('GET returns user documents without storage locations', async () => {
    m.getCurrentUser.mockResolvedValue({ id: 'u1', organizationId: 'org_1' });
    m.getUserDocuments.mockResolvedValueOnce({
      sent: [{ id: 'doc_1', title: 'Contract', status: 'completed', fileUrl: 'https://storage.example/signed.pdf' }],
      toSign: [],
    });
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/signatures/documents'));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.sent).toEqual([{
      id: 'doc_1',
      title: 'Contract',
      status: 'completed',
      evidenceClass: 'historical_evidence',
    }]);
    expect(JSON.stringify(json)).not.toContain('storage.example');
  });

  it('GET returns user documents', async () => {
    m.getCurrentUser.mockResolvedValue({ id: 'u1', organizationId: 'org_1' });
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/signatures/documents'));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toHaveLength(1);
  });

  it('GET ignores a client-supplied organizationId query param and uses the authenticated user\'s org', async () => {
    m.getCurrentUser.mockResolvedValue({ id: 'u1', organizationId: 'org_1' });
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/signatures/documents?organizationId=org_evil'));
    expect(response.status).toBe(200);
    expect(m.getUserDocuments).toHaveBeenCalledWith('u1', 'org_1');
  });
});
