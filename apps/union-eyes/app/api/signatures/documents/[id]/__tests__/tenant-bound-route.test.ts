import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  verifyDocumentAccess: vi.fn(),
  getDocumentStatus: vi.fn(),
  getDocumentSender: vi.fn(),
  voidDocument: vi.fn(),
  syncDocumentStatus: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({
  withApiAuth: (handler: unknown) => handler,
  getCurrentUser: m.getCurrentUser,
}));
vi.mock('@/lib/signature/signature-service', () => ({
  SignatureAuthorityError: class SignatureAuthorityError extends Error {
    code = 'FORBIDDEN';
  },
  SignatureService: {
    verifyDocumentAccess: m.verifyDocumentAccess,
    getDocumentStatus: m.getDocumentStatus,
    getDocumentSender: m.getDocumentSender,
    voidDocument: m.voidDocument,
    syncDocumentStatus: m.syncDocumentStatus,
  },
}));
vi.mock('@/lib/documents/signature-projection', () => ({ projectSignaturePayload: (value: unknown) => value }));
vi.mock('@/lib/signature/signer-privacy', () => ({ signatureViewForViewer: (value: unknown) => value }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { AUTH_REQUIRED: 'AUTH_REQUIRED', FORBIDDEN: 'FORBIDDEN', VALIDATION_ERROR: 'VALIDATION_ERROR', INTERNAL_ERROR: 'INTERNAL_ERROR' },
  standardErrorResponse: (code: string, message: string) => new Response(JSON.stringify({ code, message }), {
    status: ({ AUTH_REQUIRED: 401, FORBIDDEN: 403, VALIDATION_ERROR: 400, INTERNAL_ERROR: 500 } as Record<string, number>)[code] ?? 500,
  }),
}));

const request = (method: string, body?: unknown) => new NextRequest('http://localhost/api/signatures/documents/doc_own', {
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }),
});
const params = { params: { id: 'doc_own' } };

describe('signature document tenant boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.getCurrentUser.mockResolvedValue({ id: 'sender', organizationId: 'org-own' });
    m.verifyDocumentAccess.mockResolvedValue(true);
    m.getDocumentStatus.mockResolvedValue({ id: 'doc_own', sentBy: 'sender' });
    m.getDocumentSender.mockResolvedValue('sender');
    m.syncDocumentStatus.mockResolvedValue({ synced: true });
  });

  it.each(['GET', 'PATCH', 'POST'] as const)('%s refuses a tenantless identity before any service or provider operation', async (method) => {
    const route = await import('../route');
    m.getCurrentUser.mockResolvedValueOnce({ id: 'sender' });
    const handler = route[method];
    const response = await handler(request(method, method === 'PATCH' ? { action: 'void', reason: 'test' } : undefined), params);
    expect(response.status).toBe(403);
    expect(m.verifyDocumentAccess).not.toHaveBeenCalled();
    expect(m.getDocumentStatus).not.toHaveBeenCalled();
    expect(m.getDocumentSender).not.toHaveBeenCalled();
    expect(m.voidDocument).not.toHaveBeenCalled();
    expect(m.syncDocumentStatus).not.toHaveBeenCalled();
  });

  it('GET passes the authenticated tenant into document authorization and read', async () => {
    const { GET } = await import('../route');
    const response = await GET(request('GET'), params);
    expect(response.status).toBe(200);
    expect(m.verifyDocumentAccess).toHaveBeenCalledWith('doc_own', 'sender', 'org-own');
    expect(m.getDocumentStatus).toHaveBeenCalledWith('doc_own', 'org-own');
  });

  it('PATCH passes the tenant to the void service, not merely the user id', async () => {
    const { PATCH } = await import('../route');
    const response = await PATCH(request('PATCH', { action: 'void', reason: 'duplicate' }), params);
    expect(response.status).toBe(200);
    expect(m.voidDocument).toHaveBeenCalledWith('doc_own', 'sender', 'duplicate', 'org-own');
  });

  it.each([
    [{ synced: false, reason: 'provider_unavailable' }, 503],
    [{ synced: false, reason: 'no_envelope' }, 409],
    [{ synced: false, reason: 'already_applied' }, 200],
  ] as const)('POST never invents a successful sync for %j', async (result, status) => {
    const { POST } = await import('../route');
    m.syncDocumentStatus.mockResolvedValueOnce(result);
    const response = await POST(request('POST'), params);
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ success: false, synced: false, reason: result.reason });
    expect(m.syncDocumentStatus).toHaveBeenCalledWith('doc_own', 'org-own');
  });

  it('POST refuses a different sender before contacting the provider', async () => {
    const { POST } = await import('../route');
    m.getDocumentSender.mockResolvedValueOnce('someone-else');
    const response = await POST(request('POST'), params);
    expect(response.status).toBe(403);
    expect(m.getDocumentSender).toHaveBeenCalledWith('doc_own', 'org-own');
    expect(m.syncDocumentStatus).not.toHaveBeenCalled();
  });
});
