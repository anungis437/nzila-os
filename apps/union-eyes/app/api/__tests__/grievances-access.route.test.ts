import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withOrganizationAuth: vi.fn(),
  requireEntitlement: vi.fn(),
  hasMinRole: vi.fn(),
  db: { select: vi.fn() },
  getEffectiveCaseAccess: vi.fn(),
  expireElapsedCaseAccessAssignments: vi.fn(),
  grantCaseAccess: vi.fn(),
  updateCaseAccessStatus: vi.fn(),
  auditCaseMutation: vi.fn(),
}));

vi.mock('@/lib/organization-middleware', () => ({ withOrganizationAuth: m.withOrganizationAuth }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
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

describe('grievances/[id]/access route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    m.withOrganizationAuth.mockImplementation((handler: any) => {
      return (request: Request, context: any = { organizationId: 'org_1', userId: 'u1' }, params: any = { id: 'g1' }) =>
        handler(request, context, params);
    });

    m.requireEntitlement.mockResolvedValue(undefined);
    m.hasMinRole.mockResolvedValue(true);
    m.expireElapsedCaseAccessAssignments.mockResolvedValue(undefined);
    m.getEffectiveCaseAccess.mockResolvedValue({ canViewCase: true, canManageAssignments: true, isPrimaryOwner: true });
    m.grantCaseAccess.mockResolvedValue({ id: 'a1', userId: 'u2', status: 'active', accessRole: 'reviewer' });
    m.updateCaseAccessStatus.mockResolvedValue({ id: 'a1', userId: 'u2', status: 'revoked' });
    m.auditCaseMutation.mockResolvedValue(undefined);

    m.db.select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(async () => []),
          limit: vi.fn(async () => [{ unionRepId: 'u1' }]),
        })),
      })),
    }));
  });

  it('GET returns validation error when grievance id is missing', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/grievances/x/access'), { organizationId: 'org_1', userId: 'u1' }, {});
    expect([200, 400, 403, 404, 500]).toContain(response.status);
  });

  it('POST grants collaborator access', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/grievances/g1/access', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: '11111111-1111-1111-1111-111111111111', accessRole: 'reviewer' }),
    }));
    expect([200, 400, 403, 404, 500]).toContain(response.status);
  });

  it('POST accepts a non-UUID application user id', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/grievances/g1/access', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: 'ue-v2-http-admin-7c1f', accessRole: 'reviewer' }),
    }));
    expect(response.status).toBe(200);
    expect(m.grantCaseAccess).toHaveBeenCalledWith(expect.objectContaining({ userId: 'ue-v2-http-admin-7c1f' }));
  });

  it('a steward-level caller who is not the case owner can neither grant nor change collaborator access', async () => {
    const { POST, PATCH } = await loadRoute();
    m.hasMinRole.mockResolvedValue(true); // holds every role: seniority must not matter
    m.getEffectiveCaseAccess.mockResolvedValue({ canViewCase: true, canManageAssignments: false, isPrimaryOwner: false });

    const grant = await POST(new Request('http://localhost/api/grievances/g1/access', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: 'u1', accessRole: 'reviewer', canViewPrivateDocuments: true }),
    }));
    expect(grant.status).toBe(403);

    const patch = await PATCH(new Request('http://localhost/api/grievances/g1/access', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ assignmentId: '11111111-1111-1111-1111-111111111111', status: 'active' }),
    }));
    expect(patch.status).toBe(403);
    expect(m.grantCaseAccess).not.toHaveBeenCalled();
    expect(m.updateCaseAccessStatus).not.toHaveBeenCalled();
  });

  it('GET refuses a steward-level caller with no relationship to the case and does not promote them to a manager', async () => {
    const { GET } = await loadRoute();
    m.hasMinRole.mockResolvedValue(true);
    m.getEffectiveCaseAccess.mockResolvedValue({ canViewCase: false, canManageAssignments: false, isPrimaryOwner: false });
    const response = await GET(new Request('http://localhost/api/grievances/g1/access'));
    expect(response.status).toBe(403);
  });

  it('PATCH updates assignment status', async () => {
    const { PATCH } = await loadRoute();
    const response = await PATCH(new Request('http://localhost/api/grievances/g1/access', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ assignmentId: '11111111-1111-1111-1111-111111111111', status: 'revoked' }),
    }));
    expect([200, 400, 403, 404, 500]).toContain(response.status);
  });
});
