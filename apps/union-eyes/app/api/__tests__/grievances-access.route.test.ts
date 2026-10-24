import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withOrganizationAuth: vi.fn(),
  requireEntitlement: vi.fn(),
  hasMinRole: vi.fn(),
  db: { select: vi.fn() },
  getEffectiveCaseAccess: vi.fn(),
  expireElapsedCaseAccessAssignments: vi.fn(),
  grantCaseAccessGuarded: vi.fn(),
  revokeCaseAccessGuarded: vi.fn(),
  auditCaseMutation: vi.fn(),
}));

vi.mock('@/lib/organization-middleware', () => ({ withOrganizationAuth: m.withOrganizationAuth }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/services/case-access-service', () => ({
  getEffectiveCaseAccess: m.getEffectiveCaseAccess,
  expireElapsedCaseAccessAssignments: m.expireElapsedCaseAccessAssignments,
  grantCaseAccessGuarded: m.grantCaseAccessGuarded,
  revokeCaseAccessGuarded: m.revokeCaseAccessGuarded,
}));
vi.mock('@/lib/audited-case-mutations', () => ({
  auditCaseMutation: m.auditCaseMutation,
  CaseAuditEvent: {
    CASE_ACCESS_GRANTED: 'CASE_ACCESS_GRANTED',
    CASE_ACCESS_REVOKED: 'CASE_ACCESS_REVOKED',
    CASE_ACCESS_EXPIRED: 'CASE_ACCESS_EXPIRED',
    CASE_ACCESS_UPDATED: 'CASE_ACCESS_UPDATED',
    CASE_ACCESS_DENIED: 'CASE_ACCESS_DENIED',
  },
}));

async function loadRoute() {
  return import('../grievances/[id]/access/route');
}

const grantRequest = (extra: Record<string, unknown> = {}) =>
  new Request('http://localhost/api/grievances/g1/access', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: 'ue-v2-http-admin-7c1f', accessRole: 'reviewer', ...extra }),
  });

const revokeRequest = (status = 'revoked') =>
  new Request('http://localhost/api/grievances/g1/access', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ assignmentId: '11111111-1111-1111-1111-111111111111', status }),
  });

describe('grievances/[id]/access route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    m.withOrganizationAuth.mockImplementation((handler: any) => {
      return (request: Request, context: any = { organizationId: 'org_1', userId: 'u1' }, params: any = { id: 'g1' }) =>
        handler(request, context, params);
    });

    m.requireEntitlement.mockResolvedValue(undefined);
    // Org-wide seniority must never be what authorizes these routes.
    m.hasMinRole.mockResolvedValue(true);
    m.expireElapsedCaseAccessAssignments.mockResolvedValue(undefined);
    m.getEffectiveCaseAccess.mockResolvedValue({ canViewCase: true, canManageAssignments: true, isPrimaryOwner: true });
    m.grantCaseAccessGuarded.mockResolvedValue({
      ok: true,
      access: { id: 'a1', userId: 'u2', status: 'active', accessRole: 'reviewer' },
    });
    m.revokeCaseAccessGuarded.mockResolvedValue({
      ok: true,
      before: { id: 'a1', userId: 'u2', status: 'active' },
      updated: { id: 'a1', userId: 'u2', status: 'revoked' },
    });
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

  it('GET denies a steward+ with no relationship to the case', async () => {
    m.getEffectiveCaseAccess.mockResolvedValue({ canViewCase: false, canManageAssignments: false, isPrimaryOwner: false });
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/grievances/g1/access'), { organizationId: 'org_1', userId: 'u1' }, { id: 'g1' });
    expect(response.status).toBe(403);
  });

  it('GET does not promote a collaborator to access management by role seniority', async () => {
    m.getEffectiveCaseAccess.mockResolvedValue({ canViewCase: true, canManageAssignments: false, isPrimaryOwner: false });
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/grievances/g1/access'), { organizationId: 'org_1', userId: 'u1' }, { id: 'g1' });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.data.effectiveAccess.canManageAssignments).toBe(false);
  });

  it('POST grants collaborator access and audits it', async () => {
    const { POST } = await loadRoute();
    const response = await POST(grantRequest());
    expect(response.status).toBe(200);
    expect(m.grantCaseAccessGuarded).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'ue-v2-http-admin-7c1f', grantedBy: 'u1', organizationId: 'org_1', grievanceId: 'g1' }),
    );
    // The grant and its audit record are written by the service inside one transaction.
    expect(m.auditCaseMutation).not.toHaveBeenCalled();
  });

  it('POST by a steward+ who does not own the case is forbidden and audited as denied', async () => {
    m.grantCaseAccessGuarded.mockResolvedValue({
      ok: false, status: 403, code: 'CASE_MANAGEMENT_AUTHORITY_REQUIRED', message: 'Only the primary owner of this case may grant collaborator access.',
    });
    const { POST } = await loadRoute();
    const response = await POST(grantRequest({ userId: 'u1', canViewPrivateDocuments: true }));
    expect(response.status).toBe(403);
    expect(m.auditCaseMutation).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'CASE_ACCESS_DENIED', details: expect.objectContaining({ reason: 'CASE_MANAGEMENT_AUTHORITY_REQUIRED' }) }),
    );
    expect(m.auditCaseMutation).not.toHaveBeenCalledWith(expect.objectContaining({ event: 'CASE_ACCESS_GRANTED' }));
  });

  it('POST maps an ineligible grantee to a validation error', async () => {
    m.grantCaseAccessGuarded.mockResolvedValue({ ok: false, status: 400, code: 'GRANTEE_INELIGIBLE', message: 'nope' });
    const { POST } = await loadRoute();
    const response = await POST(grantRequest());
    expect(response.status).toBe(400);
  });

  it('POST rejects malformed JSON without a server error', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/grievances/g1/access', { method: 'POST', body: '{' }));
    expect(response.status).toBe(400);
    expect(m.grantCaseAccessGuarded).not.toHaveBeenCalled();
  });

  it('PATCH revokes an assignment and audits it', async () => {
    const { PATCH } = await loadRoute();
    const response = await PATCH(revokeRequest());
    expect(response.status).toBe(200);
    expect(m.auditCaseMutation).not.toHaveBeenCalled();
  });

  it('PATCH cannot reactivate a grant', async () => {
    const { PATCH } = await loadRoute();
    const response = await PATCH(revokeRequest('active'));
    expect(response.status).toBe(400);
    expect(m.revokeCaseAccessGuarded).not.toHaveBeenCalled();
  });

  it('PATCH by a non-owner steward+ is forbidden', async () => {
    m.revokeCaseAccessGuarded.mockResolvedValue({
      ok: false, status: 403, code: 'CASE_MANAGEMENT_AUTHORITY_REQUIRED', message: 'no',
    });
    const { PATCH } = await loadRoute();
    const response = await PATCH(revokeRequest());
    expect(response.status).toBe(403);
  });
});
