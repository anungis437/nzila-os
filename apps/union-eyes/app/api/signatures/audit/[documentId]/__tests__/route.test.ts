import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApiAuth: vi.fn(),
  getCurrentUser: vi.fn(),
  verifyDocumentAccess: vi.fn(),
  getDocumentAudit: vi.fn(),
  generateAuditReport: vi.fn(),
  standardErrorResponse: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withApiAuth: m.withApiAuth, getCurrentUser: m.getCurrentUser }));
vi.mock('@/lib/signature/signature-service', () => ({
  AuditTrailService: {
    getDocumentAudit: m.getDocumentAudit,
    generateAuditReport: m.generateAuditReport,
  },
  SignatureService: {
    verifyDocumentAccess: m.verifyDocumentAccess,
  },
}));
vi.mock('@/lib/api/standardized-responses', () => {
  const statusByCode: Record<string, number> = {
    AUTH_REQUIRED: 401,
    FORBIDDEN: 403,
    INTERNAL_ERROR: 500,
  };
  return {
    ErrorCode: { AUTH_REQUIRED: 'AUTH_REQUIRED', FORBIDDEN: 'FORBIDDEN', INTERNAL_ERROR: 'INTERNAL_ERROR' },
    standardErrorResponse: m.standardErrorResponse.mockImplementation((code: string, message: string) =>
      new Response(JSON.stringify({ code, message }), { status: statusByCode[code] ?? 400 })),
  };
});

async function loadRoute() {
  return import('../route');
}

describe('signatures/audit/[documentId] route (PR #752 round 49 — cross-tenant IDOR fix)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApiAuth.mockImplementation((handler: any) => handler);
    m.getCurrentUser.mockResolvedValue({ id: 'caller-own-id' });
    m.verifyDocumentAccess.mockResolvedValue(true);
    m.getDocumentAudit.mockResolvedValue([{ id: 'evt_1' }]);
  });

  it('returns 403 when the caller has no access to the document (cross-tenant IDOR regression)', async () => {
    const { GET } = await loadRoute();
    m.verifyDocumentAccess.mockResolvedValueOnce(false);

    const response = await GET(
      new NextRequest('http://localhost/api/signatures/audit/doc_victim'),
      { params: { documentId: 'doc_victim' } },
    );

    expect(response.status).toBe(403);
    expect(m.verifyDocumentAccess).toHaveBeenCalledWith('doc_victim', 'caller-own-id');
    expect(m.getDocumentAudit).not.toHaveBeenCalled();
  });

  it('returns the audit trail when the caller has access', async () => {
    const { GET } = await loadRoute();

    const response = await GET(
      new NextRequest('http://localhost/api/signatures/audit/doc_own'),
      { params: { documentId: 'doc_own' } },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.events).toEqual([{ id: 'evt_1' }]);
    expect(m.getDocumentAudit).toHaveBeenCalledWith('doc_own');
  });

  it('returns 401 when unauthenticated', async () => {
    const { GET } = await loadRoute();
    m.getCurrentUser.mockResolvedValueOnce(null);

    const response = await GET(
      new NextRequest('http://localhost/api/signatures/audit/doc_own'),
      { params: { documentId: 'doc_own' } },
    );

    expect(response.status).toBe(401);
    expect(m.verifyDocumentAccess).not.toHaveBeenCalled();
  });
});
