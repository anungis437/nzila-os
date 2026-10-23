import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withOrganizationAuth: vi.fn(),
  requireEntitlement: vi.fn(),
  hasMinRole: vi.fn(),
  hasSupervisoryCaseRead: vi.fn(),
  db: { select: vi.fn() },
  limitQueue: [] as unknown[][],
  getEffectiveCaseAccess: vi.fn(),
  expireElapsedCaseAccessAssignments: vi.fn(),
  grantCaseAccess: vi.fn(),
  updateCaseAccessStatus: vi.fn(),
  auditCaseMutation: vi.fn(),
}));

vi.mock('@/lib/organization-middleware', () => ({ withOrganizationAuth: m.withOrganizationAuth }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@/lib/cases/supervisory-case-read', () => ({ hasSupervisoryCaseRead: m.hasSupervisoryCaseRead }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/services/case-access-service', () => ({
  getEffectiveCaseAccess: m.getEffectiveCaseAccess,
  expireElapsedCaseAccessAssignments: m.expireElapsedCaseAccessAssignments,
  grantCaseAccess: m.grantCaseAccess,
  updateCaseAccessStatus: m.updateCaseAccessStatus,
}));
vi.mock('@/lib/audited-case-mutations', () => ({
  auditCaseMutation: m.auditCaseMutation,
  CaseAuditEvent: {
    CASE_ACCESS_GRANTED: 'CASE_ACCESS_GRANTED',
    CASE_ACCESS_REVOKED: 'CASE_ACCESS_REVOKED',
    CASE_ACCESS_EXPIRED: 'CASE_ACCESS_EXPIRED',
    CASE_ACCESS_UPDATED: 'CASE_ACCESS_UPDATED',
  },
}));

async function loadRoute() {
  return import('../grievances/[id]/access/route');
}

const ctx = { organizationId: 'org_1', userId: 'u1' };
const post = (body: unknown) => new Request('http://localhost/api/grievances/g1/access', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});
const owner = { canViewCase: true, canManageAssignments: true, isPrimaryOwner: true };
const nonOwner = { canViewCase: false, canManageAssignments: false, isPrimaryOwner: false };

describe('grievances/[id]/access route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.limitQueue = [];

    m.withOrganizationAuth.mockImplementation((handler: any) =>
      (request: Request, context: any = ctx, params: any = { id: 'g1' }) => handler(request, context, params));
    m.requireEntitlement.mockResolvedValue(undefined);
    m.hasMinRole.mockResolvedValue(true);
    m.hasSupervisoryCaseRead.mockResolvedValue(false);
    m.expireElapsedCaseAccessAssignments.mockResolvedValue(undefined);
    m.getEffectiveCaseAccess.mockResolvedValue(owner);
    m.grantCaseAccess.mockResolvedValue({ id: 'a1', userId: 'u2', status: 'active', accessRole: 'reviewer' });
    m.updateCaseAccessStatus.mockResolvedValue({ id: 'a1', userId: 'u2', status: 'revoked' });
    m.auditCaseMutation.mockResolvedValue(undefined);

    m.db.select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(async () => []),
          limit: vi.fn(async () => m.limitQueue.shift() ?? [{ id: 'row', unionRepId: 'u1' }]),
        })),
      })),
    }));
  });

  it('GET denies an ordinary steward who has no ownership or collaborator assignment', async () => {
    m.getEffectiveCaseAccess.mockResolvedValue(nonOwner);
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/grievances/g1/access'), ctx, { id: 'g1' });
    expect(response.status).toBe(403);
  });

  it('GET allows supervisory authority to read the assignment list', async () => {
    m.getEffectiveCaseAccess.mockResolvedValue(nonOwner);
    m.hasSupervisoryCaseRead.mockResolvedValue(true);
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/grievances/g1/access'), ctx, { id: 'g1' });
    expect(response.status).toBe(200);
  });

  it('POST denies an ordinary steward who is not the primary owner and grants nothing', async () => {
    m.getEffectiveCaseAccess.mockResolvedValue(nonOwner);
    const { POST } = await loadRoute();
    const response = await POST(post({ userId: 'u2', accessRole: 'reviewer', canViewPrivateDocuments: true }));
    expect(response.status).toBe(403);
    expect(m.grantCaseAccess).not.toHaveBeenCalled();
    expect(m.auditCaseMutation).not.toHaveBeenCalled();
  });

  it('POST lets the primary owner delegate to an active organization member', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post({ userId: 'ue-v2-http-admin-7c1f', accessRole: 'reviewer' }));
    expect(response.status).toBe(200);
    expect(m.grantCaseAccess).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org_1', grievanceId: 'g1', userId: 'ue-v2-http-admin-7c1f', grantedBy: 'u1',
    }));
    expect(m.auditCaseMutation).toHaveBeenCalled();
  });

  it('POST lets supervisory authority delegate on a case it does not own', async () => {
    m.getEffectiveCaseAccess.mockResolvedValue(nonOwner);
    m.hasSupervisoryCaseRead.mockResolvedValue(true);
    const { POST } = await loadRoute();
    expect((await POST(post({ userId: 'u2', accessRole: 'read_only' }))).status).toBe(200);
  });

  it('POST refuses a grantee who is not an active member of the organization', async () => {
    m.limitQueue = [[]];
    const { POST } = await loadRoute();
    const response = await POST(post({ userId: 'outsider', accessRole: 'reviewer' }));
    expect(response.status).toBe(400);
    expect(m.grantCaseAccess).not.toHaveBeenCalled();
  });

  it('POST refuses a grievance that does not belong to the caller organization', async () => {
    m.limitQueue = [[{ id: 'member-row' }], []];
    m.hasSupervisoryCaseRead.mockResolvedValue(true);
    const { POST } = await loadRoute();
    const response = await POST(post({ userId: 'u2', accessRole: 'reviewer' }));
    expect(response.status).toBe(404);
    expect(m.grantCaseAccess).not.toHaveBeenCalled();
  });

  it('PATCH denies an ordinary steward who is not the primary owner', async () => {
    m.getEffectiveCaseAccess.mockResolvedValue(nonOwner);
    const { PATCH } = await loadRoute();
    const response = await PATCH(new Request('http://localhost/api/grievances/g1/access', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ assignmentId: '11111111-1111-4111-8111-111111111111', status: 'revoked' }),
    }));
    expect(response.status).toBe(403);
    expect(m.updateCaseAccessStatus).not.toHaveBeenCalled();
  });

  it('PATCH lets the primary owner revoke an assignment and audits it', async () => {
    const { PATCH } = await loadRoute();
    const response = await PATCH(new Request('http://localhost/api/grievances/g1/access', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ assignmentId: '11111111-1111-4111-8111-111111111111', status: 'revoked' }),
    }));
    expect(response.status).toBe(200);
    expect(m.auditCaseMutation).toHaveBeenCalledWith(expect.objectContaining({ event: 'CASE_ACCESS_REVOKED' }));
  });
});
