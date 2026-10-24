import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  getOrganizationIdForUser: vi.fn(),
  getUserRoleInOrganization: vi.fn(),
  requireEntitlement: vi.fn(),
  withRLSContext: vi.fn(),
  auditDataMutation: vi.fn(),
  buildUnionEvidencePack: vi.fn(),
  recordUnionEyesCaseAssigned: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  claimQueue: [] as unknown[][],
  assigneeEligible: vi.fn(),
  insertQueue: [] as unknown[][],
  canonical: { enabled: false },
  appendCanonicalAuditLog: vi.fn(),
  updateReturning: vi.fn(),
}));

vi.mock('@/lib/auth/canonical-bootstrap', async (original) => ({
  ...(await original<typeof import('@/lib/auth/canonical-bootstrap')>()),
  currentStateContextEnabled: () => m.canonical.enabled,
}));
vi.mock('@/lib/audit/canonical-audit-chain', () => ({ appendCanonicalAuditLog: m.appendCanonicalAuditLog }));

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: m.getOrganizationIdForUser, getUserRoleInOrganization: m.getUserRoleInOrganization }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/audit-logger', () => ({ auditDataMutation: m.auditDataMutation, auditLog: vi.fn().mockResolvedValue(undefined), AuditEventType: { AUTH_FAILED: 'AUTH_FAILED' }, AuditSeverity: { HIGH: 'HIGH' } }));
vi.mock('@/lib/evidence', () => ({ buildUnionEvidencePack: m.buildUnionEvidencePack }));
vi.mock('@/lib/pilot-metrics', () => ({ recordUnionEyesCaseAssigned: m.recordUnionEyesCaseAssigned }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq') };
});


vi.mock('@/lib/cases/case-authorization', async (original) => ({
  ...(await original<typeof import('@/lib/cases/case-authorization')>()),
  findReadableCase: vi.fn(async () => (m.claimQueue.shift() ?? [])[0] ?? null),
  caseAssigneeEligible: m.assigneeEligible,
}));

async function loadRoute() {
  return import('../cases/[caseId]/assign/route');
}

describe('cases/[caseId]/assign route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.claimQueue = [];
    m.assigneeEligible.mockResolvedValue(true);
    m.insertQueue = [];
    m.canonical.enabled = false;
    m.appendCanonicalAuditLog.mockResolvedValue(undefined);
    m.updateReturning.mockResolvedValue([{ claimId: 'c1' }]);
    m.auth.mockResolvedValue({ userId: 'u1' });
    m.getOrganizationIdForUser.mockResolvedValue('org_1');
    m.getUserRoleInOrganization.mockResolvedValue('chief_steward');
    m.requireEntitlement.mockResolvedValue(undefined);
    m.auditDataMutation.mockResolvedValue(undefined);
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
    expect(m.auditDataMutation).toHaveBeenCalled();
  });
  it('denies an ineligible foreign or inactive assignee before any mutation', async () => {
    const { POST } = await loadRoute();
    m.claimQueue.push([{ claimId: 'c1', assignedTo: 'u0', status: 'under_review' }]);
    m.assigneeEligible.mockResolvedValueOnce(false);
    const response = await POST(new Request('http://localhost/api/cases/c1/assign', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({assigneeId:'foreign'}),
    }), {params:Promise.resolve({caseId:'c1'})});
    expect(response.status).toBe(403);
    expect(m.auditDataMutation).not.toHaveBeenCalled();
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

    expect(m.auditDataMutation).not.toHaveBeenCalled();
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
    expect(m.auditDataMutation).not.toHaveBeenCalled();
    expect(m.appendCanonicalAuditLog).not.toHaveBeenCalled();
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
    expect(m.auditDataMutation).not.toHaveBeenCalled();
    expect(m.buildUnionEvidencePack).not.toHaveBeenCalled();
    expect(m.recordUnionEyesCaseAssigned).not.toHaveBeenCalled();
  });

  it('writes the canonical audit inside the assignment transaction and skips the post-commit audit', async () => {
    const { POST } = await loadRoute();
    m.canonical.enabled = true;
    m.claimQueue.push([{ claimId: 'c1', memberId: 'm9', assignedTo: 'u0', status: 'filed' }]);
    m.insertQueue.push([{ updateId: 'up1' }]);
    const response = await POST(new Request('http://localhost/api/cases/c1/assign', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ assigneeId: 'u2', reason: 'coverage' }),
    }), { params: Promise.resolve({ caseId: 'c1' }) });
    expect(response.status).toBe(200);
    expect(m.appendCanonicalAuditLog).toHaveBeenCalledTimes(1);
    expect(m.appendCanonicalAuditLog.mock.calls[0][1]).toMatchObject({
      organizationId: 'org_1', resourceType: 'claims', resourceId: 'c1',
      details: { event: 'CASE_ASSIGNED', fromAssignee: 'u0', toAssignee: 'u2' },
    });
    expect(m.auditDataMutation).not.toHaveBeenCalled();
  });

  it('fails the whole request, with no success body or downstream effects, when the in-transaction audit cannot be written', async () => {
    const { POST } = await loadRoute();
    m.canonical.enabled = true;
    m.claimQueue.push([{ claimId: 'c1', memberId: 'm9', assignedTo: 'u0', status: 'filed' }]);
    m.insertQueue.push([{ updateId: 'up1' }]);
    m.appendCanonicalAuditLog.mockRejectedValueOnce(new Error('audit chain unavailable'));
    const response = await POST(new Request('http://localhost/api/cases/c1/assign', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ assigneeId: 'u2' }),
    }), { params: Promise.resolve({ caseId: 'c1' }) });
    const json = await response.json();
    expect(response.status).toBe(500);
    expect(json.success).toBeUndefined();
    expect(m.buildUnionEvidencePack).not.toHaveBeenCalled();
    expect(m.recordUnionEyesCaseAssigned).not.toHaveBeenCalled();
  });

  it('exposes committed state when only the non-canonical post-commit audit fails, and a retry is a safe no-op', async () => {
    const { POST } = await loadRoute();
    m.claimQueue.push([{ claimId: 'c1', memberId: 'm9', assignedTo: 'u0', status: 'filed' }]);
    m.insertQueue.push([{ updateId: 'up1' }]);
    m.auditDataMutation.mockRejectedValueOnce(new Error('audit down'));
    const response = await POST(new Request('http://localhost/api/cases/c1/assign', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ assigneeId: 'u2' }),
    }), { params: Promise.resolve({ caseId: 'c1' }) });
    const json = await response.json();
    expect(response.status).toBe(500);
    expect(json).toMatchObject({ error: 'ASSIGNMENT_COMMITTED_AUDIT_FAILED', assignedTo: 'u2', previousAssignee: 'u0', historyRecordId: 'up1' });
    expect(json.success).toBeUndefined();

    m.claimQueue.push([{ claimId: 'c1', memberId: 'm9', assignedTo: 'u2', status: 'filed' }]);
    const retry = await POST(new Request('http://localhost/api/cases/c1/assign', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ assigneeId: 'u2' }),
    }), { params: Promise.resolve({ caseId: 'c1' }) });
    expect(retry.status).toBe(200);
    expect((await retry.json()).transferred).toBe(false);
  });

  it('denies member assignment before opening a case transaction', async () => {
    const { POST } = await loadRoute();
    m.getUserRoleInOrganization.mockResolvedValueOnce('member');
    const response = await POST(new Request('http://localhost/api/cases/c1/assign', {
      method:'POST', body:JSON.stringify({assigneeId:'foreign'}),
    }), {params:Promise.resolve({caseId:'c1'})});
    expect(response.status).toBe(403);
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });

});
