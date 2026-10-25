import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  getOrganizationIdForUser: vi.fn(),
  getUserRoleInOrganization: vi.fn(),
  requireEntitlement: vi.fn(),
  withRLSContext: vi.fn(),
  persistAtomicAudit: vi.fn(),
  buildUnionEvidencePack: vi.fn(),
  recordUnionEyesCaseAssigned: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  claimQueue: [] as unknown[][],
  assigneeEligible: vi.fn(),
  insertQueue: [] as unknown[][],
  updateReturning: vi.fn(),
  findReadableCase: vi.fn(),
  assignPrimaryRepresentative: vi.fn(),
}));

vi.mock('@/lib/services/case-access-service', () => ({ assignPrimaryRepresentative: m.assignPrimaryRepresentative }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: m.getOrganizationIdForUser, getUserRoleInOrganization: m.getUserRoleInOrganization }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/audit-logger', () => ({ auditLog: vi.fn().mockResolvedValue(undefined), AuditEventType: { AUTH_FAILED: 'AUTH_FAILED' }, AuditSeverity: { HIGH: 'HIGH' } }));
vi.mock('@/lib/evidence', () => ({ buildUnionEvidencePack: m.buildUnionEvidencePack }));
vi.mock('@/lib/pilot-metrics', () => ({ recordUnionEyesCaseAssigned: m.recordUnionEyesCaseAssigned }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq') };
});


vi.mock('@/lib/cases/case-authorization', async (original) => ({
  ...(await original<typeof import('@/lib/cases/case-authorization')>()),
  findReadableCase: m.findReadableCase,
  caseAssigneeEligible: m.assigneeEligible,
}));

async function loadRoute() {
  return import('../cases/[caseId]/assign/route');
}

describe('cases/[caseId]/assign route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.claimQueue = [];
    m.findReadableCase.mockImplementation(async () => {
      const claim = (m.claimQueue.shift() ?? [])[0] as { assignedTo?: string | null } | undefined;
      // The kernel records the previous holder; the claims mirror is only used to seed it here.
      m.assignPrimaryRepresentative.mockResolvedValue({ previousUserId: claim?.assignedTo ?? null });
      return claim ?? null;
    });
    m.assignPrimaryRepresentative.mockResolvedValue({ previousUserId: null });
    m.assigneeEligible.mockResolvedValue(true);
    m.insertQueue = [];
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.updateReturning.mockResolvedValue([{ claimId: 'c1' }]);
    m.auth.mockResolvedValue({ userId: 'u1' });
    m.getOrganizationIdForUser.mockResolvedValue('org_1');
    m.getUserRoleInOrganization.mockResolvedValue('chief_steward');
    m.requireEntitlement.mockResolvedValue(undefined);
    m.buildUnionEvidencePack.mockResolvedValue(undefined);
    m.recordUnionEyesCaseAssigned.mockResolvedValue(undefined);
    m.withRLSContext.mockImplementation(async (fn: any) => {
      const tx = {
        select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => (m.claimQueue.shift() ?? []) as unknown[]) })) })) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(async () => m.updateReturning()) })) })) })),
        insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(async () => (m.insertQueue.shift() ?? []) as unknown[]) })) })),
      };
      return fn(tx);
    });
  });

  it('returns 401 when unauthenticated', async () => {
    const { POST } = await loadRoute();
    m.auth.mockResolvedValueOnce({ userId: null });

    const response = await POST(new Request('http://localhost/api/cases/c1/assign', { method: 'POST', body: '{}' }), { params: Promise.resolve({ caseId: 'c1' }) });
    expect(response.status).toBe(401);
  });

  it('returns 400 for invalid json', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/cases/c1/assign', { method: 'POST', body: '{bad-json' }), { params: Promise.resolve({ caseId: 'c1' }) });
    expect(response.status).toBe(400);
  });

  it('returns 400 for validation error', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/cases/c1/assign', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ assigneeId: '' }),
    }), { params: Promise.resolve({ caseId: 'c1' }) });

    expect(response.status).toBe(400);
  });

  it('returns 404 when case does not exist', async () => {
    const { POST } = await loadRoute();
    m.claimQueue.push([]);

    const response = await POST(new Request('http://localhost/api/cases/c1/assign', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ assigneeId: 'u2' }),
    }), { params: Promise.resolve({ caseId: 'c1' }) });

    expect(response.status).toBe(404);
  });

  it('assigns case successfully', async () => {
    const { POST } = await loadRoute();
    m.claimQueue.push([{ claimId: 'c1', assignedTo: 'u0', status: 'filed' }]);
    m.insertQueue.push([{ updateId: 'up1' }]);

    const response = await POST(new Request('http://localhost/api/cases/c1/assign', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-trace-id': 't1' }, body: JSON.stringify({ assigneeId: 'u2', reason: 'workload' }),
    }), { params: Promise.resolve({ caseId: 'c1' }) });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.assignedTo).toBe('u2');
    expect(m.persistAtomicAudit).toHaveBeenCalled();
  });
  it('denies an ineligible foreign or inactive assignee before any mutation', async () => {
    const { POST } = await loadRoute();
    m.claimQueue.push([{ claimId: 'c1', assignedTo: 'u0', status: 'under_review' }]);
    m.assigneeEligible.mockResolvedValueOnce(false);
    const response = await POST(new Request('http://localhost/api/cases/c1/assign', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({assigneeId:'foreign'}),
    }), {params:Promise.resolve({caseId:'c1'})});
    expect(response.status).toBe(403);
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    expect(m.buildUnionEvidencePack).not.toHaveBeenCalled();
    expect(m.insertQueue).toEqual([]);
  });
  it('denies assigning a case to the member who filed it or by that member (conflict) before mutation', async () => {
    const { POST } = await loadRoute();
    const post = (assigneeId: string) => POST(new Request('http://localhost/api/cases/c1/assign', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ assigneeId }),
    }), { params: Promise.resolve({ caseId: 'c1' }) });

    m.claimQueue.push([{ claimId: 'c1', memberId: 'u1', assignedTo: 'u0', status: 'filed' }]);
    expect((await post('u2')).status).toBe(403);

    m.claimQueue.push([{ claimId: 'c1', memberId: 'u2', assignedTo: 'u0', status: 'filed' }]);
    expect((await post('u2')).status).toBe(403);

    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    expect(m.insertQueue).toEqual([]);
  });

  it('treats a repeated identical request as an idempotent no-op: 200, no write, no audit', async () => {
    const { POST } = await loadRoute();
    m.claimQueue.push([{ claimId: 'c1', memberId: 'm9', assignedTo: 'u2', status: 'filed' }]);
    const response = await POST(new Request('http://localhost/api/cases/c1/assign', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ assigneeId: 'u2' }),
    }), { params: Promise.resolve({ caseId: 'c1' }) });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json).toMatchObject({ success: true, transferred: false, assignedTo: 'u2' });
    expect(m.updateReturning).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    expect(m.buildUnionEvidencePack).not.toHaveBeenCalled();
  });

  it('reports a concurrent reassignment as a 409 conflict and performs no history, audit or evidence write', async () => {
    const { POST } = await loadRoute();
    m.claimQueue.push([{ claimId: 'c1', memberId: 'm9', assignedTo: 'u0', status: 'filed' }]);
    m.updateReturning.mockResolvedValueOnce([]);
    const response = await POST(new Request('http://localhost/api/cases/c1/assign', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ assigneeId: 'u2' }),
    }), { params: Promise.resolve({ caseId: 'c1' }) });
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe('ASSIGNMENT_CONFLICT');
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    expect(m.buildUnionEvidencePack).not.toHaveBeenCalled();
    expect(m.recordUnionEyesCaseAssigned).not.toHaveBeenCalled();
  });

  it('writes the audit inside the assignment transaction, in every deployment mode', async () => {
    const { POST } = await loadRoute();
    m.claimQueue.push([{ claimId: 'c1', memberId: 'm9', assignedTo: 'u0', status: 'filed' }]);
    m.insertQueue.push([{ updateId: 'up1' }]);
    const response = await POST(new Request('http://localhost/api/cases/c1/assign', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ assigneeId: 'u2', reason: 'coverage' }),
    }), { params: Promise.resolve({ caseId: 'c1' }) });
    expect(response.status).toBe(200);
    expect(m.persistAtomicAudit).toHaveBeenCalledTimes(1);
    expect(m.persistAtomicAudit.mock.calls[0][1]).toMatchObject({
      organizationId: 'org_1', action: 'case.assign', resourceType: 'claims', resourceId: 'c1',
      details: { event: 'CASE_ASSIGNED', fromAssignee: 'u0', toAssignee: 'u2' },
    });
  });

  it('fails the whole request, with no success body or downstream effects, when the in-transaction audit cannot be written', async () => {
    const { POST } = await loadRoute();
    m.claimQueue.push([{ claimId: 'c1', memberId: 'm9', assignedTo: 'u0', status: 'filed' }]);
    m.insertQueue.push([{ updateId: 'up1' }]);
    m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit chain unavailable'));
    const response = await POST(new Request('http://localhost/api/cases/c1/assign', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ assigneeId: 'u2' }),
    }), { params: Promise.resolve({ caseId: 'c1' }) });
    const json = await response.json();
    expect(response.status).toBe(500);
    expect(json.success).toBeUndefined();
    // There is no committed-but-unaudited state to expose: the assignment, its history and its audit are one transaction.
    expect(json.error).not.toBe('ASSIGNMENT_COMMITTED_AUDIT_FAILED');
    expect(m.buildUnionEvidencePack).not.toHaveBeenCalled();
    expect(m.recordUnionEyesCaseAssigned).not.toHaveBeenCalled();
  });

  it('denies member assignment on the kernel decision before any mutation', async () => {
    const { POST } = await loadRoute();
    const { ApiError } = await import('@/lib/api/errors');
    m.findReadableCase.mockRejectedValueOnce(ApiError.forbidden('This action is not permitted for this case.'));
    const response = await POST(new Request('http://localhost/api/cases/c1/assign', {
      method:'POST', headers: { 'content-type': 'application/json' }, body:JSON.stringify({assigneeId:'foreign'}),
    }), {params:Promise.resolve({caseId:'c1'})});
    expect(response.status).toBe(403);
    expect(m.findReadableCase).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ userId: 'u1' }), 'c1', true, 'case:assign');
    expect(m.assignPrimaryRepresentative).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    expect(m.insertQueue).toEqual([]);
  });

  it('answers 403 when the authority kernel refuses the assignment', async () => {
    const { POST } = await loadRoute();
    const { AuthorityStoreError } = await import('@/lib/authority/store/executor');
    m.claimQueue.push([{ claimId: 'c1', memberId: 'm9', assignedTo: 'u0', status: 'filed' }]);
    m.assignPrimaryRepresentative.mockRejectedValueOnce(new AuthorityStoreError('DENIED', 'no mandate'));
    const response = await POST(new Request('http://localhost/api/cases/c1/assign', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ assigneeId: 'u2' }),
    }), { params: Promise.resolve({ caseId: 'c1' }) });
    expect(response.status).toBe(403);
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    expect(m.buildUnionEvidencePack).not.toHaveBeenCalled();
  });

});
