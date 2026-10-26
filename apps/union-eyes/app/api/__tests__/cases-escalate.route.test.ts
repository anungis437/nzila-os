import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

const m = vi.hoisted(() => ({
  where: vi.fn(),
  auth: vi.fn(),
  organization: vi.fn(),
  role: vi.fn(),
  withApi: vi.fn(),
  withRLSContext: vi.fn(),
  auditLog: vi.fn(),
  updateClaimStatusById: vi.fn(),
  enforceDecision: vi.fn(),
  findReadableCase: vi.fn(),
  createNarProofAdapter: vi.fn(),
  platformDb: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn(() => ({ limit: vi.fn(async () => []) })) })) })) })),
    insert: vi.fn(() => ({ values: vi.fn(async () => null) })),
  },
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi }));
vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: m.organization, getUserRoleInOrganization: m.role }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: vi.fn(async () => undefined) }));
vi.mock('@/lib/audit-logger', () => ({
  auditLog: m.auditLog,
  AuditEventType: { CASE_ESCALATED: 'CASE_ESCALATED', AUTH_FAILED:'AUTH_FAILED' },
  AuditSeverity: { HIGH: 'HIGH' },
}));
vi.mock('@/lib/workflow-engine', () => ({ updateClaimStatusById: m.updateClaimStatusById }));
vi.mock('@nzila/decision-core', () => ({ enforceDecision: m.enforceDecision }));
vi.mock('@nzila/nar', () => ({
  createNarProofAdapter: m.createNarProofAdapter,
  getNarSigningSecret: vi.fn(),
}));
vi.mock('@nzila/db/platform', () => ({ platformDb: m.platformDb }));
vi.mock('@/lib/cases/case-authorization', async (original) => ({
  ...(await original<typeof import('@/lib/cases/case-authorization')>()),
  findReadableCase: m.findReadableCase,
}));

async function loadRoute() {
  return import('../cases/[caseId]/escalate/route');
}

describe('cases/[caseId]/escalate route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.auth.mockResolvedValue({userId:'u1'});
    m.organization.mockResolvedValue('org_1');
    m.role.mockResolvedValue('steward');
    m.findReadableCase.mockResolvedValue({ claimId: 'c1', organizationId: 'org_1', visibility: 'internal' });

    m.withApi.mockImplementation((_cfg: unknown, handler: any) => {
      return (request: Request, ctx: any = {}) =>
        handler({
          request,
          userId: ctx.userId ?? 'u1',
          organizationId: ctx.organizationId ?? 'org_1',
          params: ctx.params ?? { caseId: 'c1' },
        });
    });

    m.createNarProofAdapter.mockReturnValue({});
    m.enforceDecision.mockResolvedValue({ allowed: true, decision: { id: 'd1' } });
    m.updateClaimStatusById.mockResolvedValue({ success: true });

    m.where.mockReturnValue({limit:vi.fn(async()=>[{
      claimId:'c1',organizationId:'org_1',status:'open',claimType:'grievance_pay',
      description:'Claim desc',priority:'medium',memberId:'m1',claimNumber:'CLM-1',metadata:{},
    }])});
    m.withRLSContext.mockImplementation(async (fn: any) => fn({
      select:vi.fn(()=>({from:vi.fn(()=>({where:m.where}))})),
      insert:vi.fn(()=>({values:vi.fn(()=>({returning:vi.fn(async()=>[{id:'g1',grievanceNumber:'GRV-1'}])}))})),
      update:vi.fn(()=>({set:vi.fn(()=>({where:vi.fn(async()=>null)}))})),
    }));
  });

  it('returns 400 when caseId is missing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/cases/x/escalate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }), { params: {} });
    expect(response.status).toBe(400);
  });

  it('returns 404 before any proof or write when the case is unreadable or missing', async () => {
    m.findReadableCase.mockResolvedValueOnce(null);

    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/cases/c1/escalate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ notes: 'escalate' }),
    }));
    expect(response.status).toBe(404);
    expect(m.enforceDecision).not.toHaveBeenCalled();
  });

  it('escalates claim to grievance', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/cases/c1/escalate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ priority: 'high', notes: 'Escalating' }),
    }));
    expect(response).toMatchObject({claim:{claimId:'c1'},grievance:{id:'g1'}});
    expect(m.findReadableCase).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ userId: 'u1', organizationId: 'org_1' }), 'c1', false, 'case:transition');
    const condition=new PgDialect().sqlToQuery(m.where.mock.calls[0][0] as SQL);
    // The kernel decision resolved the case; the row is then re-read by its id within the tenant only.
    expect(condition.params).toEqual(['c1','org_1']);
  });

  it('denies member escalation on the kernel decision before querying a case or creating a proof', async () => {
    const { POST } = await loadRoute();
    const { ApiError } = await import('@/lib/api/errors');
    m.findReadableCase.mockRejectedValueOnce(ApiError.forbidden('This action is not permitted for this case.'));
    await expect(POST(new Request('http://localhost/api/cases/c1/escalate', {
      method:'POST',body:JSON.stringify({notes:'unauthorized'}),
    }))).rejects.toMatchObject({code:'FORBIDDEN'});
    expect(m.where).not.toHaveBeenCalled();
    expect(m.enforceDecision).not.toHaveBeenCalled();
  });
});
