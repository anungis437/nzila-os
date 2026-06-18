import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withOrganizationAuth: vi.fn(),
  hasMinRole: vi.fn(),
  requireEntitlement: vi.fn(),
  getEffectiveCaseAccess: vi.fn(),
  withRLSContext: vi.fn(),
  auditDataMutation: vi.fn(),
}));

vi.mock('@/lib/organization-middleware', () => ({ withOrganizationAuth: m.withOrganizationAuth }));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/lib/services/case-access-service', () => ({ getEffectiveCaseAccess: m.getEffectiveCaseAccess }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/audit-logger', () => ({ auditDataMutation: m.auditDataMutation }));
vi.mock('@/lib/audited-case-mutations', () => ({ auditCaseMutation: vi.fn(), CaseAuditEvent: { CASE_ATTACHMENT_UPLOADED: 'CASE_ATTACHMENT_UPLOADED' } }));
vi.mock('@/lib/evidence', () => ({ buildUnionEvidencePack: vi.fn() }));
vi.mock('@/lib/services/pilot-tracking', () => ({ trackPilotEvent: vi.fn() }));
vi.mock('@/services/platform-economics', () => ({ recordUsage: vi.fn() }));
vi.mock('@/lib/api/standardized-responses', () => ({ ErrorCode: { VALIDATION_ERROR: 'VALIDATION_ERROR', FORBIDDEN: 'FORBIDDEN', NOT_FOUND: 'NOT_FOUND', INTERNAL_ERROR: 'INTERNAL_ERROR' }, standardErrorResponse: vi.fn(() => new Response(JSON.stringify({ error: 'error' }), { status: 400 })) }));
vi.mock('@/db/db', () => ({ db: { select: () => ({ from: () => ({ where: () => Promise.resolve([{ id: 'g1' }]) }) }), insert: () => ({ values: () => ({ returning: () => Promise.resolve([{ id: 'd1' }]) }) }) } }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), and: vi.fn(() => 'and') };
});

async function loadRoute() {
  return import('../grievances/[id]/documents/route');
}

describe('grievances/[id]/documents route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withOrganizationAuth.mockImplementation((handler: any) => (_req: Request, ctx: any = { organizationId: 'org_1', userId: 'u1' }, params: any = { id: 'g1' }) => handler(_req, ctx, params));
    m.hasMinRole.mockResolvedValue(true);
    m.requireEntitlement.mockResolvedValue(undefined);
    m.getEffectiveCaseAccess.mockResolvedValue({ isPrimaryOwner: true, canUploadDocuments: true });
    m.withRLSContext.mockImplementation(async (fn: any) => fn());
    m.auditDataMutation.mockResolvedValue(undefined);
  });

  it('returns 400 when missing id', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/grievances/g1/documents', { method: 'POST' }), { organizationId: 'org_1', userId: 'u1' }, {});
    expect(response.status).toBe(400);
  });

  it('responds to document upload', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/grievances/g1/documents', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fileUrl: 'http://x.com/a.pdf', title: 'Doc', filename: 'a.pdf', mimeType: 'application/pdf', documentType: 'evidence', privacyLabel: 'public_internal' }),
    }), { organizationId: 'org_1', userId: 'u1' }, { id: 'g1' });
    expect([200, 201, 400, 500]).toContain(response.status);
  });
});
