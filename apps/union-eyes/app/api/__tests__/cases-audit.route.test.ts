import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  db: { select: vi.fn() },
  withRLSContext: vi.fn(),
  auditDataAccess: vi.fn(),
  requireEntitlement: vi.fn(),
  getOrganizationIdForUser: vi.fn(),
  getUserRoleInOrganization: vi.fn(),
  findReadableCase: vi.fn(),
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/db', () => ({ db: m.db }));
vi.mock('@/db/schema', () => ({ auditLogs: {} }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/audit-logger', () => ({auditDataAccess:m.auditDataAccess,auditLog:vi.fn().mockResolvedValue(undefined),AuditEventType:{AUTH_FAILED:'AUTH_FAILED'},AuditSeverity:{HIGH:'HIGH'}}));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: m.getOrganizationIdForUser, getUserRoleInOrganization:m.getUserRoleInOrganization }));

vi.mock('@/lib/cases/case-authorization', async original => ({
  ...(await original<typeof import('@/lib/cases/case-authorization')>()),
  findReadableCase:m.findReadableCase,
}));

async function loadRoute() {
  return import('../cases/[caseId]/audit/route');
}

describe('cases/[caseId]/audit route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.findReadableCase.mockResolvedValue({claimId:'c1',visibility:'internal'});
    m.auth.mockResolvedValue({ userId: 'u1' });
    m.getOrganizationIdForUser.mockResolvedValue('org_1');
    m.getUserRoleInOrganization.mockResolvedValue('officer');
    m.requireEntitlement.mockResolvedValue(undefined);
    m.withRLSContext.mockImplementation(async (_context: unknown, fn: any) => fn({execute:vi.fn().mockResolvedValue([{auditId:'a1'}])}));
    m.db.select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(async () => [
              { auditId: 'a1', action: 'update', userId: 'u1', createdAt: new Date() },
            ]),
          })),
        })),
      })),
    }));
    m.auditDataAccess.mockResolvedValue(undefined);
  });

  it('returns 401 when not authenticated', async () => {
    const { GET } = await loadRoute();
    m.auth.mockResolvedValueOnce({ userId: null });

    const response = await GET(new Request('http://localhost/api/cases/c1/audit'), {
      params: Promise.resolve({ caseId: 'c1' }),
    });

    expect(response.status).toBe(401);
  });

  it('returns audit timeline data', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new Request('http://localhost/api/cases/c1/audit'), {
      params: Promise.resolve({ caseId: 'c1' }),
    });

    expect(response.status).toBe(200);
  });

  it('returns 500 when query fails', async () => {
    const { GET } = await loadRoute();
    m.withRLSContext.mockRejectedValueOnce(new Error('db failure'));

    const response = await GET(new Request('http://localhost/api/cases/c1/audit'), {
      params: Promise.resolve({ caseId: 'c1' }),
    });

    expect(response.status).toBe(500);
  });
  it('does not disclose internal audit metadata to a member', async () => {
    const { GET } = await loadRoute();
    const { ApiError } = await import('@/lib/api/errors');
    m.findReadableCase.mockRejectedValueOnce(ApiError.forbidden('This action is not permitted for this case.'));
    const response=await GET(new Request('http://localhost/api/cases/c1/audit'),{params:Promise.resolve({caseId:'c1'})});
    expect(response.status).toBe(403);
    expect(m.findReadableCase).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ userId: 'u1' }), 'c1', false, 'case:read_internal');
    expect(m.auditDataAccess).not.toHaveBeenCalled();
  });

  it('answers 404 when the caller cannot read the case at all', async () => {
    const { GET } = await loadRoute();
    m.findReadableCase.mockResolvedValueOnce(null);
    const response=await GET(new Request('http://localhost/api/cases/c1/audit'),{params:Promise.resolve({caseId:'c1'})});
    expect(response.status).toBe(404);
    expect(m.auditDataAccess).not.toHaveBeenCalled();
  });

});
