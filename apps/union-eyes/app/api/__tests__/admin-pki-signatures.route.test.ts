import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  signDocument: vi.fn(),
  getWorkflow: vi.fn(),
  recordSignature: vi.fn(),
  verifySignature: vi.fn(),
  verifyDocumentIntegrity: vi.fn(),
  memberRows: [] as unknown[],
  performAuditedOperation: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({
  withRoleAuth: (_role: string, handler: (r: NextRequest, c: unknown) => unknown) => (r: NextRequest, c: unknown = {}) =>
    handler(r, { userId: 'u1', organizationId: 'org-a', ...(c as object) }),
}));
vi.mock('@/services/pki/signature-service', () => ({ signDocument: m.signDocument }));
vi.mock('@/services/pki/workflow-engine', () => ({ getWorkflow: m.getWorkflow, recordSignature: m.recordSignature }));
vi.mock('@/services/pki/verification-service', () => ({
  verifySignature: m.verifySignature,
  verifyDocumentIntegrity: m.verifyDocumentIntegrity,
}));
vi.mock('@/lib/audit/operation-audit', () => ({
  performAuditedOperation: m.performAuditedOperation,
  operationAuditResponse: () => null,
}));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_ctx: unknown, work: (tx: unknown) => unknown) =>
    work({ select: () => ({ from: () => ({ where: () => ({ limit: async () => m.memberRows }) }) }) }),
}));
vi.mock('@/db/schema/organization-members-schema', () => ({ organizationMembers: { email: 'email', userId: 'userId', organizationId: 'organizationId' } }));
vi.mock('drizzle-orm', () => ({ and: vi.fn(), eq: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/api/authorization-denial', () => ({ throwIfUnprovisionedRelation: vi.fn() }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { AUTH_REQUIRED: 'AUTH_REQUIRED', VALIDATION_ERROR: 'VALIDATION_ERROR', RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND', FORBIDDEN: 'FORBIDDEN' },
  standardErrorResponse: (code: string, message: string) =>
    new Response(JSON.stringify({ code, message }), {
      status: code === 'RESOURCE_NOT_FOUND' ? 404 : code === 'FORBIDDEN' ? 403 : code === 'AUTH_REQUIRED' ? 401 : 400,
    }),
}));

const signBody = {
  documentType: 'agreement',
  documentUrl: 'https://example.com/doc.pdf',
  userName: 'Sam Signer',
  userTitle: 'Secretary',
  userEmail: 'sam@example.com',
  workflowId: '11111111-1111-4111-8111-111111111111',
};

const post = (path: string, body: unknown) =>
  new NextRequest(`http://localhost/api/admin/pki/signatures/doc1/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('admin/pki/signatures/[id]/sign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.memberRows = [{ email: 'Sam@Example.com' }];
    m.performAuditedOperation.mockImplementation((_op: unknown, run: () => unknown) => run());
    m.getWorkflow.mockReturnValue({ id: signBody.workflowId, organizationId: 'org-a' });
    m.signDocument.mockResolvedValue({ signatureId: 'sig1' });
    m.recordSignature.mockResolvedValue({ state: 'in_progress' });
  });

  const call = async (body: unknown = signBody) => {
    const { POST } = await import('../admin/pki/signatures/[id]/sign/route');
    return POST(post('sign', body), { params: { id: 'doc1' } } as never);
  };

  it('signs as the authenticated member, audited before the signature exists', async () => {
    const response = await call();
    expect(response.status).toBe(200);
    expect(m.performAuditedOperation).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-a', userId: 'u1', action: 'pki.document.sign', resourceId: 'doc1' }),
      expect.any(Function),
    );
    expect((await response.json()).workflowRecorded).toBe(true);
  });

  it('refuses to sign under another person\'s email', async () => {
    const response = await call({ ...signBody, userEmail: 'someone.else@example.com' });
    expect(response.status).toBe(403);
    expect(m.signDocument).not.toHaveBeenCalled();
  });

  it('refuses when the caller has no membership record', async () => {
    m.memberRows = [];
    expect((await call()).status).toBe(403);
    expect(m.signDocument).not.toHaveBeenCalled();
  });

  it('is a 404 for another organization\'s workflow', async () => {
    m.getWorkflow.mockReturnValue({ id: signBody.workflowId, organizationId: 'org-b' });
    expect((await call()).status).toBe(404);
    expect(m.signDocument).not.toHaveBeenCalled();
  });

  it('does not sign when the intent cannot be recorded', async () => {
    m.performAuditedOperation.mockRejectedValueOnce(new Error('audit down'));
    expect((await call()).status).toBe(500);
    expect(m.signDocument).not.toHaveBeenCalled();
  });

  it('says so when the workflow could not record the signature', async () => {
    m.recordSignature.mockRejectedValueOnce(new Error('workflow gone'));
    const body = await (await call()).json();
    expect(body.workflowRecorded).toBe(false);
  });
});

describe('admin/pki/signatures/[id]/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.performAuditedOperation.mockImplementation((_op: unknown, run: () => unknown) => run());
    m.verifySignature.mockResolvedValue({ isValid: true });
    m.verifyDocumentIntegrity.mockResolvedValue({ isIntact: true });
  });

  const call = async (body: unknown, ctx: object = {}) => {
    const { POST } = await import('../admin/pki/signatures/[id]/verify/route');
    return POST(post('verify', body), { params: { id: 'sig1' }, ...ctx } as never);
  };

  it('verifies only within the caller\'s organization, and records who verified', async () => {
    const response = await call({});
    expect(response.status).toBe(200);
    expect(m.verifySignature).toHaveBeenCalledWith('sig1', undefined, 'org-a');
    expect(m.performAuditedOperation).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-a', userId: 'u1', action: 'pki.signature.verify' }),
      expect.any(Function),
    );
  });

  it('scopes document verification to the organization too', async () => {
    await call({ verifyType: 'document' });
    expect(m.verifyDocumentIntegrity).toHaveBeenCalledWith('sig1', undefined, 'org-a');
  });

  it('is a 404 for a signature the organization does not hold', async () => {
    m.verifySignature.mockRejectedValueOnce(new Error('Signature not found'));
    expect((await call({})).status).toBe(404);
  });

  it('refuses without an organization context', async () => {
    expect((await call({}, { organizationId: undefined })).status).toBe(401);
    expect(m.verifySignature).not.toHaveBeenCalled();
  });
});
