import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withOrganizationAuth: vi.fn(),
  requireEntitlement: vi.fn(),
  hasMinRole: vi.fn(),
  db: { select: vi.fn(), update: vi.fn(), insert: vi.fn() },
  tx: { update: vi.fn(), insert: vi.fn() },
  withRLSContext: vi.fn(),
  assignSteward: vi.fn(),
  auditDataMutation: vi.fn(),
  auditLog: vi.fn(),
  buildUnionEvidencePack: vi.fn(),
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
  requestAssignmentConvergence: vi.fn(),
  processAssignmentConvergence: vi.fn(),
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
vi.mock('@/lib/deadline-engine', () => ({
  requestAssignmentConvergence: m.requestAssignmentConvergence,
  processAssignmentConvergence: m.processAssignmentConvergence,
}));

async function loadRoute() {
  return import('../grievances/[id]/assign/route');
}

const NEW_STEWARD = '11111111-1111-1111-1111-111111111111';

describe('grievances/[id]/assign route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withOrganizationAuth.mockImplementation(
      (handler: any) =>
        (request: Request, context: any = { organizationId: 'org_1', userId: 'u1' }, params: any = { id: 'g1' }) =>
          handler(request, context, params),
    );
    m.requireEntitlement.mockResolvedValue(undefined);
    m.hasMinRole.mockResolvedValue(true);
    m.assignSteward.mockResolvedValue({ grievanceId: 'g1', stewardId: NEW_STEWARD });
    m.auditDataMutation.mockResolvedValue(undefined);
    m.auditLog.mockResolvedValue(undefined);
    m.buildUnionEvidencePack.mockResolvedValue(undefined);
    // withRLSContext passes a tx handle to the callback — the route inserts
    // the convergence task through it so the task's existence is atomic
    // with the assignment update.
    m.withRLSContext.mockImplementation(async (fn: any) => fn(m.tx));
    m.requestAssignmentConvergence.mockResolvedValue({ taskId: 'task-1' });
    m.processAssignmentConvergence.mockResolvedValue({
      taskId: 'task-1',
      converged: true,
      refreshedDeadlineIds: ['dl-1'],
    });

    m.db.select = vi.fn(() => ({
      from: vi.fn(() => ({ where: vi.fn(async () => [{ id: 'g1', unionRepId: 'officer-A' }]) })),
    }));
    m.tx.update = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => null) })) }));
    m.tx.insert = vi.fn(() => ({ values: vi.fn(async () => null) }));
  });

  function assignRequest(body: Record<string, unknown> = { stewardId: NEW_STEWARD }) {
    return new Request('http://localhost/api/grievances/g1/assign', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('returns 400 when the request body is invalid (missing stewardId)', async () => {
    const { PATCH } = await loadRoute();
    const response = await PATCH(assignRequest({}));
    expect(response.status).toBe(400);
  });

  it('returns 403 for a caller below officer role', async () => {
    m.hasMinRole.mockResolvedValueOnce(false);
    const { PATCH } = await loadRoute();
    const response = await PATCH(assignRequest());
    expect(response.status).toBe(403);
  });

  it('returns 404 when the grievance does not belong to the caller organization (wrong-org)', async () => {
    m.db.select = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => []) })) }));
    const { PATCH } = await loadRoute();
    const response = await PATCH(assignRequest());
    expect(response.status).toBe(404);
    expect(m.requestAssignmentConvergence).not.toHaveBeenCalled();
    expect(m.processAssignmentConvergence).not.toHaveBeenCalled();
    expect(m.tx.update).not.toHaveBeenCalled();
  });

  it('assigns the steward, updates unionRepId via the transaction, and records + processes a convergence task', async () => {
    const { PATCH } = await loadRoute();
    const response = await PATCH(assignRequest());
    expect(response.status).toBe(200);

    expect(m.tx.update).toHaveBeenCalled();
    expect(m.requestAssignmentConvergence).toHaveBeenCalledTimes(1);
    expect(m.requestAssignmentConvergence).toHaveBeenCalledWith(
      m.tx,
      expect.objectContaining({
        grievanceId: 'g1',
        organizationId: 'org_1',
        previousAssigneeId: 'officer-A',
        newAssigneeId: NEW_STEWARD,
      }),
    );
    // The convergence task is inserted INSIDE the same transaction as the
    // assignment update — an assignment can never commit without a durable
    // retryable task existing.
    expect(m.requestAssignmentConvergence.mock.invocationCallOrder[0]).toBeLessThan(
      m.processAssignmentConvergence.mock.invocationCallOrder[0],
    );
    expect(m.processAssignmentConvergence).toHaveBeenCalledWith('task-1', { type: 'user', id: 'u1' });
  });

  it('reads the OUTGOING representative from the pre-update grievance row (proves continuity, not a stale snapshot)', async () => {
    m.db.select = vi.fn(() => ({
      from: vi.fn(() => ({ where: vi.fn(async () => [{ id: 'g1', unionRepId: 'officer-OLD' }]) })),
    }));
    const { PATCH } = await loadRoute();
    await PATCH(assignRequest());

    expect(m.requestAssignmentConvergence).toHaveBeenCalledWith(
      m.tx,
      expect.objectContaining({ previousAssigneeId: 'officer-OLD', newAssigneeId: NEW_STEWARD }),
    );
  });

  it('does not claim success when reminder continuity cannot be guaranteed (convergence fails)', async () => {
    m.processAssignmentConvergence.mockRejectedValueOnce(
      new Error('deadline-engine.assignment-sync: failed to refresh reminders for 1 of 1 deadline(s)'),
    );
    const { PATCH } = await loadRoute();
    const response = await PATCH(assignRequest());
    expect(response.status).toBe(500);
  });

  it('does not strand the handoff: the durable task is recorded even when the immediate convergence attempt fails', async () => {
    m.processAssignmentConvergence.mockRejectedValueOnce(new Error('scheduler unavailable'));
    const { PATCH } = await loadRoute();
    await PATCH(assignRequest());

    // The task was recorded (atomically with the assignment) BEFORE the
    // failing convergence attempt — it remains pending in the DB for the
    // reminder worker's sweep to retry, rather than being lost with the 500.
    expect(m.requestAssignmentConvergence).toHaveBeenCalledTimes(1);
  });

  it('handles a grievance with no prior representative (previousAssigneeId is null)', async () => {
    m.db.select = vi.fn(() => ({
      from: vi.fn(() => ({ where: vi.fn(async () => [{ id: 'g1', unionRepId: null }]) })),
    }));
    const { PATCH } = await loadRoute();
    const response = await PATCH(assignRequest());
    expect(response.status).toBe(200);
    expect(m.requestAssignmentConvergence).toHaveBeenCalledWith(
      m.tx,
      expect.objectContaining({ previousAssigneeId: null, newAssigneeId: NEW_STEWARD }),
    );
  });
});
