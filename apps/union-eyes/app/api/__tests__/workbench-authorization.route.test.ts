import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  getCaseActor: vi.fn(),
  caseReadScope: vi.fn(() => 'READ_SCOPE'),
  requireCaseAction: vi.fn(),
  findReadableCase: vi.fn(),
  caseAssigneeEligible: vi.fn(),
  denyCaseAction: vi.fn(),
  withRLSContext: vi.fn(),
  auditLog: vi.fn(),
  execute: vi.fn(),
}));

class TestApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
  static forbidden(message = 'forbidden') { return new TestApiError(message, 403); }
}

vi.mock('@/lib/api/framework', () => ({
  withApi: (_cfg: unknown, handler: (ctx: unknown) => unknown) => (ctx: unknown) => handler(ctx),
  ApiError: TestApiError,
}));
vi.mock('@/lib/cases/case-authorization', () => ({
  getCaseActor: m.getCaseActor,
  caseReadScope: m.caseReadScope,
  requireCaseAction: m.requireCaseAction,
  findReadableCase: m.findReadableCase,
  caseAssigneeEligible: m.caseAssigneeEligible,
  denyCaseAction: m.denyCaseAction,
  caseAuthorizationResponse: () => null,
}));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/audit-logger', () => ({
  auditLog: m.auditLog,
  AuditEventType: { DATA_UPDATE: 'DATA_UPDATE' },
  AuditSeverity: { MEDIUM: 'MEDIUM' },
}));
vi.mock('@/lib/cases/claim-history-reference', () => ({ claimHistoryReference: (id: string) => id }));
vi.mock('@/db/schema/claims-schema', () => ({ claims: {}, claimUpdates: {} }));
vi.mock('drizzle-orm', () => {
  const sql = Object.assign((parts: TemplateStringsArray, ...values: unknown[]) => ({ parts, values }), {
    join: (items: unknown[]) => ({ joined: items }),
  });
  return { sql, eq: vi.fn() };
});

const steward = { userId: 'steward-1', organizationId: 'org-1', role: 'steward' };
const chief = { userId: 'chief-1', organizationId: 'org-1', role: 'chief_steward' };

describe('GET /api/workbench/assigned', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.getCaseActor.mockResolvedValue(steward);
    m.withRLSContext.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({ execute: m.execute }));
    m.execute.mockResolvedValue([{
      claimId: 'c1', claimNumber: 'CLM-1', memberId: 'm1', assignedTo: 'other', description: 'secret',
      memberEmail: 'm@example.test', status: 'submitted',
    }]);
  });

  it('rejects a client-supplied organization that differs from the authenticated membership', async () => {
    const { GET } = await import('../workbench/assigned/route');
    await expect(GET({ request: new NextRequest('http://localhost/api/workbench/assigned?organizationId=org-2') }))
      .rejects.toMatchObject({ status: 403 });
    expect(m.execute).not.toHaveBeenCalled();
  });

  it('applies the actor case read scope and redacts matters without case authority', async () => {
    m.getCaseActor.mockResolvedValue(chief);
    const { GET } = await import('../workbench/assigned/route');
    const result = await GET({ request: new NextRequest('http://localhost/api/workbench/assigned') }) as any;
    expect(m.caseReadScope).toHaveBeenCalledWith(chief, 'c');
    expect(result.claims[0].access).toBe('triage');
    expect(result.claims[0]).not.toHaveProperty('memberEmail');
    expect(result.claims[0]).not.toHaveProperty('description');
    expect(result.capabilities.canAssign).toBe(true);
  });

  it('does not offer assignment to an ordinary steward', async () => {
    const { GET } = await import('../workbench/assigned/route');
    const result = await GET({ request: new NextRequest('http://localhost/api/workbench/assigned?organizationId=org-1') }) as any;
    expect(result.capabilities.canAssign).toBe(false);
  });
});

describe('POST /api/workbench/assign', () => {
  const ctx = (body: unknown) => ({ body });
  const claimId = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    vi.clearAllMocks();
    m.getCaseActor.mockResolvedValue(steward);
    m.requireCaseAction.mockResolvedValue(undefined);
    m.withRLSContext.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({
      update: () => ({ set: () => ({ where: vi.fn() }) }),
      insert: () => ({ values: vi.fn() }),
    }));
    m.findReadableCase.mockResolvedValue({ claimId, assignedTo: null });
    m.caseAssigneeEligible.mockResolvedValue(true);
    m.auditLog.mockResolvedValue(undefined);
  });

  it('denies self-assignment when the case_assign policy denies the actor', async () => {
    m.requireCaseAction.mockRejectedValue(TestApiError.forbidden());
    const { POST } = await import('../workbench/assign/route');
    await expect(POST(ctx({ claimId }))).rejects.toMatchObject({ status: 403 });
    expect(m.withRLSContext).not.toHaveBeenCalled();
    expect(m.auditLog).not.toHaveBeenCalled();
  });

  it('returns 404 for a claim outside the actor read scope (e.g. another organization)', async () => {
    m.getCaseActor.mockResolvedValue(chief);
    m.findReadableCase.mockResolvedValue(null);
    const { POST } = await import('../workbench/assign/route');
    const res = await POST(ctx({ claimId, assignTo: 'steward-2' })) as Response;
    expect(res.status).toBe(404);
    expect(m.auditLog).not.toHaveBeenCalled();
  });

  it('refuses an ineligible assignee', async () => {
    m.getCaseActor.mockResolvedValue(chief);
    m.caseAssigneeEligible.mockResolvedValue(false);
    m.denyCaseAction.mockRejectedValue(TestApiError.forbidden());
    const { POST } = await import('../workbench/assign/route');
    await expect(POST(ctx({ claimId, assignTo: 'member-1' }))).rejects.toMatchObject({ status: 403 });
    expect(m.auditLog).not.toHaveBeenCalled();
  });

  it('assigns and audits with the authenticated organization', async () => {
    m.getCaseActor.mockResolvedValue(chief);
    const { POST } = await import('../workbench/assign/route');
    const result = await POST(ctx({ claimId, assignTo: 'steward-2' })) as any;
    expect(result.claim).toEqual({ claimId, assignedTo: 'steward-2' });
    expect(m.auditLog).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-1', userId: 'chief-1' }));
  });
});
