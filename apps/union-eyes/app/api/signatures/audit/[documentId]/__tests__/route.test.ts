import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  verifyDocumentAccess: vi.fn(),
  getDocumentSender: vi.fn(),
  getDocumentAudit: vi.fn(),
  generateAuditReport: vi.fn(),
}));

vi.mock('@/lib/api/framework', async () => (await import('@/app/api/__tests__/support/with-api-stub')).frameworkModule);
vi.mock('@/lib/signature/signature-service', () => ({
  AuditTrailService: {
    getDocumentAudit: m.getDocumentAudit,
    generateAuditReport: m.generateAuditReport,
  },
  SignatureService: {
    verifyDocumentAccess: m.verifyDocumentAccess,
    getDocumentSender: m.getDocumentSender,
  },
}));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));

const { caller, declared, resetCaller } = await import('@/app/api/__tests__/support/with-api-stub');

const DOC_VICTIM = '00000000-0000-4000-8000-0000000000aa';
const DOC_OWN = '00000000-0000-4000-8000-0000000000bb';

async function get(documentId: string, query = '') {
  const { GET } = await import('../route');
  return GET(new NextRequest(`http://localhost/api/signatures/audit/${documentId}${query}`), { params: { documentId } });
}

describe('signatures/audit/[documentId] route (PR #752 round 49 — cross-tenant IDOR fix)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCaller();
    caller.userId = 'caller-own-id';
    caller.organizationId = 'org-own';
    m.verifyDocumentAccess.mockResolvedValue(true);
    m.getDocumentSender.mockResolvedValue('caller-own-id');
    m.getDocumentAudit.mockResolvedValue([{ id: 'evt_1' }]);
    m.generateAuditReport.mockResolvedValue({ documentId: DOC_OWN, events: [{ id: 'evt_1' }] });
  });

  it('asks the wrapper for an authenticated caller and the caller organization tenant transaction', async () => {
    await get(DOC_OWN);

    expect(declared.at(-1)).toMatchObject({ auth: { required: true }, rlsOrgContext: true });
  });

  it('returns 403 when the caller has no access to the document (cross-tenant IDOR regression)', async () => {
    m.verifyDocumentAccess.mockResolvedValueOnce(false);

    const response = await get(DOC_VICTIM);

    expect(response.status).toBe(403);
    expect(m.verifyDocumentAccess).toHaveBeenCalledWith(DOC_VICTIM, 'caller-own-id', 'org-own');
    expect(m.getDocumentAudit).not.toHaveBeenCalled();
  });

  it('returns the audit trail when the caller has access', async () => {
    const response = await get(DOC_OWN);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.events).toEqual([{ id: 'evt_1' }]);
    expect(payload.totalEvents).toBe(1);
    expect(m.getDocumentAudit).toHaveBeenCalledWith(DOC_OWN, 'org-own');
  });

  it('returns the audit report for format=report, read in the caller organization', async () => {
    const response = await get(DOC_OWN, '?format=report');
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.message).toBe('Audit report generated successfully');
    expect(payload.report).toEqual({ documentId: DOC_OWN, events: [{ id: 'evt_1' }] });
    expect(m.generateAuditReport).toHaveBeenCalledWith(DOC_OWN, 'org-own');
    expect(m.getDocumentAudit).not.toHaveBeenCalled();
  });

  it('answers a malformed document id as a client error before any lookup, never a database fault', async () => {
    const response = await get('doc_victim');

    expect(response.status).toBe(400);
    expect(m.verifyDocumentAccess).not.toHaveBeenCalled();
    expect(m.getDocumentAudit).not.toHaveBeenCalled();
  });

  it('fails closed when the authenticated user has no current organization', async () => {
    caller.organizationId = null;

    const response = await get(DOC_OWN);

    expect(response.status).toBe(403);
    expect(m.verifyDocumentAccess).not.toHaveBeenCalled();
    expect(m.getDocumentSender).not.toHaveBeenCalled();
    expect(m.generateAuditReport).not.toHaveBeenCalled();
    expect(m.getDocumentAudit).not.toHaveBeenCalled();
  });

  it('rejects an explicitly empty tenant even for report format, before any signature lookup', async () => {
    caller.organizationId = '';

    const response = await get(DOC_OWN, '?format=report');

    expect(response.status).toBe(403);
    expect(m.verifyDocumentAccess).not.toHaveBeenCalled();
    expect(m.getDocumentSender).not.toHaveBeenCalled();
    expect(m.generateAuditReport).not.toHaveBeenCalled();
    expect(m.getDocumentAudit).not.toHaveBeenCalled();
  });

  it('returns 401 when unauthenticated', async () => {
    caller.userId = null;

    const response = await get(DOC_OWN);

    expect(response.status).toBe(401);
    expect(m.verifyDocumentAccess).not.toHaveBeenCalled();
  });
});
