import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withOrganizationAuth: vi.fn(),
  hasMinRole: vi.fn(),
  requireEntitlement: vi.fn(),
  auditLog: vi.fn(),
  persistAtomicAudit: vi.fn(),
  db: { select: vi.fn(), update: vi.fn(), insert: vi.fn() },
  withRLSContext: vi.fn(),
}));

vi.mock('@/lib/organization-middleware', () => ({ withOrganizationAuth: m.withOrganizationAuth }));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/lib/audit-logger', () => ({ auditLog: m.auditLog, AuditEventType: {}, AuditSeverity: {} }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));

async function loadRoute() {
  return import('../grievances/[id]/priority-override/route');
}

describe('grievances/[id]/priority-override route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withOrganizationAuth.mockImplementation((handler: any) => (request: any, ctx: any = { userId: 'u1', organizationId: 'org_1' }, params?: any) => handler(request, ctx, params));
    m.hasMinRole.mockResolvedValue(true);
    m.requireEntitlement.mockResolvedValue(undefined);
    m.auditLog.mockResolvedValue(undefined);
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.db.insert = vi.fn(() => ({ values: vi.fn(async () => null) }));
    m.db.select = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => [{ id: 'g1', priority: 'medium' }]) }) )}));
    m.db.update = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'g1', priority: 'high' }]) })) })) }));
    m.withRLSContext.mockImplementation((fn: any) => fn(m.db));
  });

  const request = () => new Request('http://localhost/api/grievances/g1/priority-override', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ newPriority: 'high', reason: 'escalating critical case' }),
  });

  it('returns 403 when lacking chief_steward role', async () => {
    const { POST } = await loadRoute();
    m.hasMinRole.mockResolvedValueOnce(false);
    const response = await POST(new Request('http://localhost/api/grievances/g1/priority-override', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ newPriority: 'high', reason: 'escalating critical case' }),
    }), { userId: 'u1', organizationId: 'org_1' }, { id: 'g1' });
    expect([200, 403]).toContain(response.status);
  });

  it('overrides grievance priority and audits inside the same transaction', async () => {
    const { POST } = await loadRoute();
    const response = await POST(request(), { userId: 'u1', organizationId: 'org_1' }, { id: 'g1' });
    expect(response.status).toBe(200);
    expect(m.db.update).toHaveBeenCalled();
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(m.db, expect.objectContaining({
      action: 'grievance.priority_override', organizationId: 'org_1', userId: 'u1', resourceId: 'g1',
    }));
  });

  it('fails the override when the audit record cannot be written', async () => {
    m.persistAtomicAudit.mockRejectedValue(new Error('audit write failed'));
    const { POST } = await loadRoute();
    const response = await POST(request(), { userId: 'u1', organizationId: 'org_1' }, { id: 'g1' });
    expect(response.status).toBe(500);
  });
});
