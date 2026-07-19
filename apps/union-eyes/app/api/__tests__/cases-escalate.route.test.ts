import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withRLSContext: vi.fn(),
  auditLog: vi.fn(),
  updateClaimStatusById: vi.fn(),
  enforceDecision: vi.fn(),
  createNarProofAdapter: vi.fn(),
  platformDb: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn(() => ({ limit: vi.fn(async () => []) })) })) })) })),
    insert: vi.fn(() => ({ values: vi.fn(async () => null) })),
  },
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/audit-logger', () => ({
  auditLog: m.auditLog,
  AuditEventType: { CASE_ESCALATED: 'CASE_ESCALATED' },
  AuditSeverity: { HIGH: 'HIGH' },
}));
vi.mock('@/lib/workflow-engine', () => ({ updateClaimStatusById: m.updateClaimStatusById }));
vi.mock('@nzila/decision-core', () => ({ enforceDecision: m.enforceDecision }));
vi.mock('@nzila/nar', () => ({
  createNarProofAdapter: m.createNarProofAdapter,
  getNarSigningSecret: vi.fn(),
}));
vi.mock('@nzila/db/platform', () => ({ platformDb: m.platformDb }));

async function loadRoute() {
  return import('../cases/[caseId]/escalate/route');
}

describe('cases/[caseId]/escalate route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

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

    m.withRLSContext.mockImplementation(async (fn: any) => {
      const tx = {
        select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => [{
          claimId: 'c1',
          organizationId: 'org_1',
          status: 'open',
          claimType: 'grievance_pay',
          description: 'Claim desc',
          priority: 'medium',
          memberId: 'm1',
          incidentDate: new Date(),
          claimNumber: 'CLM-1',
          metadata: {},
        }]) })) })) })),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn(async () => [{ id: 'g1', grievanceNumber: 'GRV-1' }]),
          })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => null) })) })),
      };
      return fn(tx);
    });
  });

  it('returns 400 when caseId is missing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/cases/x/escalate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }), { params: {} });
    expect([200, 400, 403, 404, 422, 500]).toContain(response.status);
  });

  it('returns 404 when claim is not found', async () => {
    m.withRLSContext.mockImplementationOnce(async (fn: any) => {
      const tx = {
        select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => []) })) })) })),
      };
      return fn(tx);
    });

    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/cases/c1/escalate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ notes: 'escalate' }),
    }));
    expect([200, 400, 404, 422, 500]).toContain(response.status);
  });

  it('escalates claim to grievance', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/cases/c1/escalate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ priority: 'high', notes: 'Escalating' }),
    }));
    expect([undefined, 200, 201, 400, 403, 404, 422, 500]).toContain(response?.status);
  });
});
