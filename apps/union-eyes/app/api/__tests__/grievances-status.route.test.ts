import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withOrganizationAuth: vi.fn(),
  requireEntitlement: vi.fn(),
  hasMinRole: vi.fn(),
  hasSupervisoryCaseRead: vi.fn(),
  getEffectiveCaseAccess: vi.fn(),
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
vi.mock('@/lib/cases/supervisory-case-read', () => ({ hasSupervisoryCaseRead: m.hasSupervisoryCaseRead }));
vi.mock('@/lib/services/case-access-service', () => ({ getEffectiveCaseAccess: m.getEffectiveCaseAccess }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/workflow/case-lifecycle', () => ({ validateTransition: m.validateTransition }));
vi.mock('@/lib/workflow/state-bridge', () => ({ toLifecycleState: m.toLifecycleState }));
vi.mock('@/lib/audit-logger', () => ({
  auditDataMutation: m.auditDataMutation,
  auditLog: m.auditLog,
  AuditEventType: { INTAKE_CLOSED: 'INTAKE_CLOSED', INTAKE_REVIEWED: 'INTAKE_REVIEWED', AUTHORITY_VIOLATION: 'AUTHORITY_VIOLATION' },
  AuditSeverity: { MEDIUM: 'MEDIUM', HIGH: 'HIGH' },
}));
vi.mock('@/lib/evidence', () => ({ buildUnionEvidencePack: m.buildUnionEvidencePack }));
vi.mock('@/lib/services/pilot-tracking', () => ({ trackPilotEvent: m.trackPilotEvent }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));

async function loadRoute() {
  return import('../grievances/[id]/status/route');
}

const patch = (status: string) => new Request('http://localhost/api/grievances/g1/status', {
  method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }),
});
const noAccess = { isPrimaryOwner: false, isSecondaryCollaborator: false, accessRole: null };

function stubGrievance(row: Record<string, unknown> | null) {
  m.db.select = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => (row ? [row] : [])) })) }));
}

describe('grievances/[id]/status route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withOrganizationAuth.mockImplementation((handler: any) =>
      (request: Request, context: any = { organizationId: 'org_1', userId: 'u1' }, params: any = { id: 'g1' }) =>
        handler(request, context, params));
    m.requireEntitlement.mockResolvedValue(undefined);
    m.hasMinRole.mockResolvedValue(true);
    m.hasSupervisoryCaseRead.mockResolvedValue(false);
    m.getEffectiveCaseAccess.mockResolvedValue(noAccess);
    m.toLifecycleState.mockReturnValue('submitted');
    m.validateTransition.mockReturnValue({ allowed: true });
    m.auditDataMutation.mockResolvedValue(undefined);
    m.auditLog.mockResolvedValue(undefined);
    m.buildUnionEvidencePack.mockResolvedValue(undefined);
    m.trackPilotEvent.mockResolvedValue(undefined);
    m.withRLSContext.mockImplementation(async (fn: any) => fn());

    stubGrievance({ id: 'g1', status: 'filed', unionRepId: 'u2' });
    m.db.update = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'g1', status: 'investigating' }]) })) })) }));
    m.db.insert = vi.fn(() => ({ values: vi.fn(async () => null) }));
  });

  it('returns validation error for a missing id', async () => {
    const { PATCH } = await loadRoute();
    const response = await PATCH(patch('filed'), { organizationId: 'org_1', userId: 'u1' }, {});
    expect(response.status).toBe(400);
  });

  it('returns not found for a grievance outside the organization', async () => {
    stubGrievance(null);
    const { PATCH } = await loadRoute();
    expect((await PATCH(patch('filed'))).status).toBe(404);
  });

  it('refuses a steward who has no authority over the matter and writes nothing', async () => {
    const { PATCH } = await loadRoute();
    const response = await PATCH(patch('investigating'));
    expect(response.status).toBe(403);
    expect(m.validateTransition).not.toHaveBeenCalled();
    expect(m.db.update).not.toHaveBeenCalled();
    expect(m.auditLog).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'AUTHORITY_VIOLATION', outcome: 'failure', organizationId: 'org_1', userId: 'u1', resourceId: 'g1',
    }));
  });

  it('refuses a read-only or reviewer collaborator', async () => {
    m.getEffectiveCaseAccess.mockResolvedValue({ isPrimaryOwner: false, isSecondaryCollaborator: true, accessRole: 'reviewer' });
    const { PATCH } = await loadRoute();
    expect((await PATCH(patch('investigating'))).status).toBe(403);
    expect(m.db.update).not.toHaveBeenCalled();
  });

  it('lets the primary representative advance the case', async () => {
    m.getEffectiveCaseAccess.mockResolvedValue({ isPrimaryOwner: true, isSecondaryCollaborator: false, accessRole: 'primary_owner' });
    const { PATCH } = await loadRoute();
    expect((await PATCH(patch('investigating'))).status).toBe(200);
    expect(m.validateTransition).toHaveBeenCalled();
    expect(m.db.update).toHaveBeenCalled();
  });

  it('lets an active secondary LRO advance the case', async () => {
    m.getEffectiveCaseAccess.mockResolvedValue({ isPrimaryOwner: false, isSecondaryCollaborator: true, accessRole: 'secondary_lro' });
    const { PATCH } = await loadRoute();
    expect((await PATCH(patch('investigating'))).status).toBe(200);
  });

  it('lets supervisory authority advance a case it does not own', async () => {
    m.hasSupervisoryCaseRead.mockResolvedValue(true);
    const { PATCH } = await loadRoute();
    expect((await PATCH(patch('investigating'))).status).toBe(200);
  });

  it('lets a steward dispose of an unassigned intake awaiting triage', async () => {
    stubGrievance({ id: 'g1', status: 'draft', unionRepId: null });
    const { PATCH } = await loadRoute();
    expect((await PATCH(patch('closed_no_case'))).status).toBe(200);
  });

  it('does not let a steward dispose of an intake already assigned to someone else', async () => {
    stubGrievance({ id: 'g1', status: 'draft', unionRepId: 'u2' });
    const { PATCH } = await loadRoute();
    expect((await PATCH(patch('closed_no_case'))).status).toBe(403);
  });

  it('still enforces the lifecycle state machine for authorized actors', async () => {
    m.getEffectiveCaseAccess.mockResolvedValue({ isPrimaryOwner: true, isSecondaryCollaborator: false, accessRole: 'primary_owner' });
    m.validateTransition.mockReturnValue({ allowed: false, reason: 'not allowed' });
    const { PATCH } = await loadRoute();
    expect((await PATCH(patch('closed'))).status).toBe(400);
    expect(m.db.update).not.toHaveBeenCalled();
  });
});
