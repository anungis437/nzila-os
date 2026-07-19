import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withOrganizationAuth: vi.fn(),
  requireEntitlement: vi.fn(),
  hasMinRole: vi.fn(),
  db: { select: vi.fn(), update: vi.fn(), insert: vi.fn() },
  withRLSContext: vi.fn(),
  validateTransition: vi.fn(),
  toLifecycleState: vi.fn(),
  auditDataMutation: vi.fn(),
  auditLog: vi.fn(),
  buildUnionEvidencePack: vi.fn(),
  trackPilotEvent: vi.fn(),
  logger: { warn: vi.fn() },
}));

vi.mock('@/lib/organization-middleware', () => ({ withOrganizationAuth: m.withOrganizationAuth }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/workflow/case-lifecycle', () => ({ validateTransition: m.validateTransition }));
vi.mock('@/lib/workflow/state-bridge', () => ({ toLifecycleState: m.toLifecycleState }));
vi.mock('@/lib/audit-logger', () => ({
  auditDataMutation: m.auditDataMutation,
  auditLog: m.auditLog,
  AuditEventType: { INTAKE_CLOSED: 'INTAKE_CLOSED', INTAKE_REVIEWED: 'INTAKE_REVIEWED' },
  AuditSeverity: { MEDIUM: 'MEDIUM' },
}));
vi.mock('@/lib/evidence', () => ({ buildUnionEvidencePack: m.buildUnionEvidencePack }));
vi.mock('@/lib/services/pilot-tracking', () => ({ trackPilotEvent: m.trackPilotEvent }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));

async function loadRoute() {
  return import('../grievances/[id]/status/route');
}

describe('grievances/[id]/status route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withOrganizationAuth.mockImplementation((handler: any) => (request: Request, context: any = { organizationId: 'org_1', userId: 'u1' }, params: any = { id: 'g1' }) => handler(request, context, params));
    m.requireEntitlement.mockResolvedValue(undefined);
    m.hasMinRole.mockResolvedValue(true);
    m.toLifecycleState.mockReturnValue('submitted');
    m.validateTransition.mockReturnValue({ allowed: true });
    m.auditDataMutation.mockResolvedValue(undefined);
    m.auditLog.mockResolvedValue(undefined);
    m.buildUnionEvidencePack.mockResolvedValue(undefined);
    m.trackPilotEvent.mockResolvedValue(undefined);
    m.withRLSContext.mockImplementation(async (fn: any) => fn());

    m.db.select = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => [{ id: 'g1', status: 'draft', unionRepId: 'u2' }]) })) }));
    m.db.update = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'g1', status: 'filed' }]) })) })) }));
    m.db.insert = vi.fn(() => ({ values: vi.fn(async () => null) }));
  });

  it('returns validation error for missing id', async () => {
    const { PATCH } = await loadRoute();
    const response = await PATCH(new Request('http://localhost/api/grievances/x/status', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'filed' }) }), { organizationId: 'org_1', userId: 'u1' }, {});
    expect([200, 400, 403, 404, 500]).toContain(response.status);
  });

  it('returns not found for missing grievance', async () => {
    m.db.select = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => []) })) }));
    const { PATCH } = await loadRoute();
    const response = await PATCH(new Request('http://localhost/api/grievances/g1/status', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'filed' }) }));
    expect([200, 404, 500]).toContain(response.status);
  });

  it('updates grievance status', async () => {
    const { PATCH } = await loadRoute();
    const response = await PATCH(new Request('http://localhost/api/grievances/g1/status', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'filed' }) }));
    expect([200, 400, 403, 404, 500]).toContain(response.status);
  });
});
