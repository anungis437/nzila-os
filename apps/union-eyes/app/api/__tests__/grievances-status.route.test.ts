import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  hasMinRole: vi.fn(),
  getEffectiveCaseAccess: vi.fn(),
  db: { select: vi.fn(), update: vi.fn(), insert: vi.fn() },
  withRLSContext: vi.fn(),
  validateTransition: vi.fn(),
  toLifecycleState: vi.fn(),
  persistAtomicAudit: vi.fn(),
  auditLog: vi.fn(),
  buildUnionEvidencePack: vi.fn(),
  trackPilotEvent: vi.fn(),
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule);
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@/lib/services/case-access-service', () => ({ getEffectiveCaseAccess: m.getEffectiveCaseAccess }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/workflow/case-lifecycle', () => ({ validateTransition: m.validateTransition }));
vi.mock('@/lib/workflow/state-bridge', () => ({ toLifecycleState: m.toLifecycleState }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/lib/audit-logger', () => ({
  auditLog: m.auditLog,
  AuditEventType: { INTAKE_CLOSED: 'INTAKE_CLOSED', INTAKE_REVIEWED: 'INTAKE_REVIEWED', AUTHORITY_VIOLATION: 'AUTHORITY_VIOLATION' },
  AuditSeverity: { MEDIUM: 'MEDIUM', HIGH: 'HIGH' },
}));
vi.mock('@/lib/evidence', () => ({ buildUnionEvidencePack: m.buildUnionEvidencePack }));
vi.mock('@/lib/services/pilot-tracking', () => ({ trackPilotEvent: m.trackPilotEvent }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));

const { caller, declared, resetCaller } = await import('./support/with-api-stub');

async function loadRoute() {
  return import('../grievances/[id]/status/route');
}

const GRIEVANCE = '22222222-2222-4222-8222-222222222222';
const patch = (status: string) => new Request(`http://localhost/api/grievances/${GRIEVANCE}/status`, {
  method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }),
});
const noAccess = { isPrimaryOwner: false, isSecondaryCollaborator: false, accessRole: null };

function stubGrievance(row: Record<string, unknown> | null) {
  m.db.select = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => (row ? [row] : [])) })) }));
}

describe('grievances/[id]/status route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCaller();
    caller.params = { id: GRIEVANCE };
    m.hasMinRole.mockResolvedValue(true);
    m.getEffectiveCaseAccess.mockResolvedValue(noAccess);
    m.toLifecycleState.mockReturnValue('submitted');
    m.validateTransition.mockReturnValue({ allowed: true });
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.auditLog.mockResolvedValue(undefined);
    m.buildUnionEvidencePack.mockResolvedValue(undefined);
    m.trackPilotEvent.mockResolvedValue(undefined);
    m.withRLSContext.mockImplementation(async (_context: unknown, fn: any) => fn(m.db));

    stubGrievance({ id: GRIEVANCE, status: 'filed', unionRepId: 'u2' });
    m.db.update = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(async () => [{ id: GRIEVANCE, status: 'investigating' }]) })) })) }));
    m.db.insert = vi.fn(() => ({ values: vi.fn(async () => null) }));
  });

  it('declares what it asks of the wrapper: membership, the case-suite entitlement and a tenant transaction (authority over the matter decides)', async () => {
    await loadRoute();
    const config = declared.find((entry) => entry.openapi?.summary === 'Advance a grievance through the lifecycle');
    expect(config?.auth).toEqual({ required: true });
    expect(config?.entitlement).toBe('grievance_case_suite');
    expect(config?.rlsOrgContext).toBe(true);
  });

  it('returns validation errors for an id that is not a uuid and for a status that is not one', async () => {
    const { PATCH } = await loadRoute();
    caller.params = { id: 'g1' };
    expect((await PATCH(patch('filed'))).status).toBe(400);
    caller.params = { id: GRIEVANCE };
    expect((await PATCH(patch('nonsense'))).status).toBe(400);
    expect(m.db.select).not.toHaveBeenCalled();
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
      eventType: 'AUTHORITY_VIOLATION', outcome: 'failure', organizationId: 'org_1', userId: 'u1', resourceId: GRIEVANCE,
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
    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org_1' }, expect.any(Function));
    expect(m.db.update).toHaveBeenCalled();
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(m.db, expect.objectContaining({
      action: 'grievance.status_change', organizationId: 'org_1', userId: 'u1', resourceId: GRIEVANCE,
    }));
  });

  it('answers 409 and records nothing when a concurrent transition already moved the matter', async () => {
    m.getEffectiveCaseAccess.mockResolvedValue({ isPrimaryOwner: true, isSecondaryCollaborator: false, accessRole: 'primary_owner' });
    m.db.update = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(async () => []) })) })) }));
    const { PATCH } = await loadRoute();
    expect((await PATCH(patch('investigating'))).status).toBe(409);
    expect(m.db.insert).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('fails the transition when the in-transaction audit cannot be written', async () => {
    m.getEffectiveCaseAccess.mockResolvedValue({ isPrimaryOwner: true, isSecondaryCollaborator: false, accessRole: 'primary_owner' });
    m.persistAtomicAudit.mockRejectedValue(new Error('audit write failed'));
    const { PATCH } = await loadRoute();
    const response = await PATCH(patch('investigating'));
    expect(response.status).toBeGreaterThanOrEqual(500);
  });

  it('lets an active secondary LRO advance the case', async () => {
    m.getEffectiveCaseAccess.mockResolvedValue({ isPrimaryOwner: false, isSecondaryCollaborator: true, accessRole: 'secondary_lro' });
    const { PATCH } = await loadRoute();
    expect((await PATCH(patch('investigating'))).status).toBe(200);
  });

  it('seniority is not authority: a caller holding every role who has no relationship to the case is refused', async () => {
    m.hasMinRole.mockResolvedValue(true);
    m.getEffectiveCaseAccess.mockResolvedValue(noAccess);
    const { PATCH } = await loadRoute();
    expect((await PATCH(patch('investigating'))).status).toBe(403);
    expect(m.validateTransition).not.toHaveBeenCalled();
    expect(m.db.update).not.toHaveBeenCalled();
  });

  it('lets a steward dispose of an unassigned intake awaiting triage', async () => {
    stubGrievance({ id: GRIEVANCE, status: 'draft', unionRepId: null });
    const { PATCH } = await loadRoute();
    expect((await PATCH(patch('closed_no_case'))).status).toBe(200);
  });

  it('does not let a steward dispose of an intake already assigned to someone else', async () => {
    stubGrievance({ id: GRIEVANCE, status: 'draft', unionRepId: 'u2' });
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
