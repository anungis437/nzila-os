import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  requireKernelCaseAction: vi.fn(),
  auditLog: vi.fn(),
  persistAtomicAudit: vi.fn(),
  db: { select: vi.fn(), update: vi.fn(), insert: vi.fn() },
  withRLSContext: vi.fn(),
}));

vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule);
vi.mock('@/lib/cases/case-authorization', () => ({ requireKernelCaseAction: m.requireKernelCaseAction }));
vi.mock('@/lib/audit-logger', () => ({ auditLog: m.auditLog, AuditEventType: { AUTHORITY_VIOLATION: 'AUTHORITY_VIOLATION' }, AuditSeverity: { HIGH: 'HIGH' } }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));

const { caller, declared, resetCaller } = await import('./support/with-api-stub');

async function loadRoute() {
  return import('../grievances/[id]/priority-override/route');
}

const GRIEVANCE = '22222222-2222-4222-8222-222222222222';

describe('grievances/[id]/priority-override route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCaller();
    caller.params = { id: GRIEVANCE };
    m.requireKernelCaseAction.mockResolvedValue(undefined);
    m.auditLog.mockResolvedValue(undefined);
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.db.insert = vi.fn(() => ({ values: vi.fn(async () => null) }));
    m.db.select = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => [{ id: GRIEVANCE, priority: 'medium' }]) }) )}));
    m.db.update = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(async () => [{ id: GRIEVANCE, priority: 'high' }]) })) })) }));
    m.withRLSContext.mockImplementation((_context: unknown, fn: any) => fn(m.db));
  });

  const request = (body: unknown = { newPriority: 'high', reason: 'escalating critical case' }) => new Request(`http://localhost/api/grievances/${GRIEVANCE}/priority-override`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  it('declares what it asks of the wrapper: membership, the case-suite entitlement and a tenant transaction (the kernel decides who may override)', async () => {
    await loadRoute();
    const config = declared.find((entry) => entry.openapi?.summary === 'Override the generated priority of a grievance');
    expect(config?.auth).toEqual({ required: true });
    expect(config?.entitlement).toBe('grievance_case_suite');
    expect(config?.rlsOrgContext).toBe(true);
  });

  it('answers 400 for a grievance id that is not a uuid and for a payload that is not valid, reading nothing', async () => {
    const { POST } = await loadRoute();
    caller.params = { id: 'g1' };
    expect((await POST(request())).status).toBe(400);
    caller.params = { id: GRIEVANCE };
    expect((await POST(request({ newPriority: 'high', reason: 'short' }))).status).toBe(400);
    expect((await POST(request({ newPriority: 'someday', reason: 'a long enough reason' }))).status).toBe(400);
    expect(m.db.select).not.toHaveBeenCalled();
  });

  it('answers 404 for a grievance of another organization and 400 when the priority does not change', async () => {
    const { POST } = await loadRoute();
    m.db.select = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => []) })) }));
    expect((await POST(request())).status).toBe(404);
    m.db.select = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => [{ id: GRIEVANCE, priority: 'high' }]) })) }));
    expect((await POST(request())).status).toBe(400);
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });

  it('answers 403 and writes nothing when the kernel denies case:transition, after recording the violation', async () => {
    const { POST } = await loadRoute();
    const { ApiError } = await import('@/lib/api/errors');
    m.requireKernelCaseAction.mockRejectedValueOnce(ApiError.forbidden());
    const response = await POST(request());
    expect(response.status).toBe(403);
    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org_1' }, expect.any(Function));
    expect(m.requireKernelCaseAction).toHaveBeenCalledWith(m.db, { userId: 'u1', organizationId: 'org_1' }, GRIEVANCE, 'case:transition');
    expect(m.auditLog).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'AUTHORITY_VIOLATION', action: 'priority_override', resourceId: GRIEVANCE }));
    expect(m.db.update).not.toHaveBeenCalled();
    expect(m.db.insert).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('overrides grievance priority and audits inside the same transaction', async () => {
    const { POST } = await loadRoute();
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(m.db.update).toHaveBeenCalled();
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(m.db, expect.objectContaining({
      action: 'grievance.priority_override', organizationId: 'org_1', userId: 'u1', resourceId: GRIEVANCE,
    }));
  });

  it('fails the override when the audit record cannot be written', async () => {
    m.persistAtomicAudit.mockRejectedValue(new Error('audit write failed'));
    const { POST } = await loadRoute();
    const response = await POST(request());
    expect(response.status).toBe(500);
  });
});
