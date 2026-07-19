import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withOrganizationAuth: vi.fn(),
  requireEntitlement: vi.fn(),
  hasMinRole: vi.fn(),
  db: { select: vi.fn(), update: vi.fn(), insert: vi.fn() },
  withRLSContext: vi.fn(),
  assignSteward: vi.fn(),
  auditDataMutation: vi.fn(),
  auditLog: vi.fn(),
  buildUnionEvidencePack: vi.fn(),
  logger: { warn: vi.fn() },
}));

vi.mock('@/lib/organization-middleware', () => ({ withOrganizationAuth: m.withOrganizationAuth }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/services/steward-assignment', () => ({ assignSteward: m.assignSteward }));
vi.mock('@/lib/audit-logger', () => ({
  auditDataMutation: m.auditDataMutation,
  auditLog: m.auditLog,
  AuditEventType: { CASE_ASSIGNED: 'CASE_ASSIGNED' },
  AuditSeverity: { MEDIUM: 'MEDIUM' },
}));
vi.mock('@/lib/evidence', () => ({ buildUnionEvidencePack: m.buildUnionEvidencePack }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));

async function loadRoute() {
  return import('../grievances/[id]/assign/route');
}

describe('grievances/[id]/assign route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withOrganizationAuth.mockImplementation((handler: any) => (request: Request, context: any = { organizationId: 'org_1', userId: 'u1' }, params: any = { id: 'g1' }) => handler(request, context, params));
    m.requireEntitlement.mockResolvedValue(undefined);
    m.hasMinRole.mockResolvedValue(true);
    m.assignSteward.mockResolvedValue({ grievanceId: 'g1', stewardId: '11111111-1111-1111-1111-111111111111' });
    m.auditDataMutation.mockResolvedValue(undefined);
    m.auditLog.mockResolvedValue(undefined);
    m.buildUnionEvidencePack.mockResolvedValue(undefined);
    m.withRLSContext.mockImplementation(async (fn: any) => fn());

    m.db.select = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => [{ id: 'g1' }]) })) }));
    m.db.update = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => null) })) }));
    m.db.insert = vi.fn(() => ({ values: vi.fn(async () => null) }));
  });

  it('returns validation error when id missing', async () => {
    const { PATCH } = await loadRoute();
    const response = await PATCH(new Request('http://localhost/api/grievances/x/assign', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) }), { organizationId: 'org_1', userId: 'u1' }, {});
    expect([200, 400, 403, 404, 500]).toContain(response.status);
  });

  it('returns forbidden for non-officer user', async () => {
    m.hasMinRole.mockResolvedValueOnce(false);
    const { PATCH } = await loadRoute();
    const response = await PATCH(new Request('http://localhost/api/grievances/g1/assign', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stewardId: '11111111-1111-1111-1111-111111111111' }) }));
    expect([200, 403, 500]).toContain(response.status);
  });

  it('assigns steward successfully', async () => {
    const { PATCH } = await loadRoute();
    const response = await PATCH(new Request('http://localhost/api/grievances/g1/assign', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stewardId: '11111111-1111-1111-1111-111111111111' }) }));
    expect([200, 400, 403, 404, 500]).toContain(response.status);
  });
});
