import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  tx: { select: vi.fn(), update: vi.fn(), insert: vi.fn() },
  withRLSContext: vi.fn(),
  withSystemContext: vi.fn(),
  assignSteward: vi.fn(),
  buildUnionEvidencePack: vi.fn(),
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
  requestAssignmentConvergence: vi.fn(),
  processAssignmentConvergence: vi.fn(),
  assignPrimaryRepresentative: vi.fn(),
  persistAtomicAudit: vi.fn(),
  committed: false,
  committedWhenSystemRan: undefined as boolean | undefined,
}));

vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule);
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: m.withRLSContext,
  withSystemContext: m.withSystemContext,
}));
vi.mock('@/lib/services/case-access-service', () => ({ assignPrimaryRepresentative: m.assignPrimaryRepresentative }));
vi.mock('@/lib/services/steward-assignment', () => ({ assignSteward: m.assignSteward }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/lib/evidence', () => ({ buildUnionEvidencePack: m.buildUnionEvidencePack }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/deadline-engine', () => ({
  requestAssignmentConvergence: m.requestAssignmentConvergence,
  processAssignmentConvergence: m.processAssignmentConvergence,
}));

const { caller, declared, resetCaller } = await import('./support/with-api-stub');

async function loadRoute() {
  return import('../grievances/[id]/assign/route');
}

const GRIEVANCE = '22222222-2222-4222-8222-222222222222';
const NEW_STEWARD = '11111111-1111-1111-1111-111111111111';
const NEW_STEWARD_PROFILE = '33333333-3333-4333-8333-333333333333';

describe('grievances/[id]/assign route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCaller();
    caller.role = 'officer';
    caller.params = { id: GRIEVANCE };
    m.committed = false;
    m.committedWhenSystemRan = undefined;
    m.assignSteward.mockResolvedValue({ grievanceId: GRIEVANCE, stewardId: NEW_STEWARD });
    m.buildUnionEvidencePack.mockResolvedValue(undefined);
    m.persistAtomicAudit.mockResolvedValue(undefined);
    // The route reads the grievance, assigns and records the convergence task through the transaction the context hands it.
    m.withRLSContext.mockImplementation(async (_context: unknown, fn: (tx: unknown) => Promise<unknown>) => {
      const result = await fn(m.tx);
      m.committed = true;
      return result;
    });
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => {
      m.committedWhenSystemRan = m.committed;
      return fn();
    });
    m.assignPrimaryRepresentative.mockResolvedValue({ previousUserId: 'officer-A' });
    m.requestAssignmentConvergence.mockResolvedValue({ taskId: 'task-1' });
    m.processAssignmentConvergence.mockResolvedValue({
      taskId: 'task-1',
      converged: true,
      refreshedDeadlineIds: ['dl-1'],
    });

    m.tx.select = vi.fn(() => ({
      from: vi.fn(() => ({ where: vi.fn(async () => [{ id: GRIEVANCE }]) })),
    }));
    m.tx.update = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => null) })) }));
    m.tx.insert = vi.fn(() => ({ values: vi.fn(async () => null) }));
  });

  function assignRequest(body: Record<string, unknown> = { stewardId: NEW_STEWARD_PROFILE }) {
    return new Request(`http://localhost/api/grievances/${GRIEVANCE}/assign`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('declares what it asks of the wrapper: an officer, the case-suite entitlement, and its own transactions', async () => {
    await loadRoute();
    const config = declared.find((entry) => entry.openapi?.summary === 'Assign a steward to a grievance');
    expect(config?.auth).toEqual({ required: true, minRole: 'officer' });
    expect(config?.entitlement).toBe('grievance_case_suite');
    // The assignment must commit before the system-role convergence step, so the wrapper must not hold one transaction around the handler.
    expect(config?.requireOrg).toBe(false);
    expect(config?.rlsOrgContext).toBeUndefined();
  });

  it('returns 400 when the request body is invalid (missing stewardId)', async () => {
    const { PATCH } = await loadRoute();
    const response = await PATCH(assignRequest({}));
    expect(response.status).toBe(400);
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });

  it('returns 400 for a grievance id that is not a uuid, without opening a transaction', async () => {
    caller.params = { id: 'not-a-uuid' };
    const { PATCH } = await loadRoute();
    const response = await PATCH(assignRequest());
    expect(response.status).toBe(400);
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });

  it('returns 403 for a caller below officer role', async () => {
    caller.role = 'member';
    const { PATCH } = await loadRoute();
    const response = await PATCH(assignRequest());
    expect(response.status).toBe(403);
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });

  it('returns 403 when the caller has no organization, before anything is read', async () => {
    caller.organizationId = null;
    const { PATCH } = await loadRoute();
    const response = await PATCH(assignRequest());
    expect(response.status).toBe(403);
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });

  it('returns 404 when the grievance does not belong to the caller organization (wrong-org)', async () => {
    m.tx.select = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => []) })) }));
    const { PATCH } = await loadRoute();
    const response = await PATCH(assignRequest());
    expect(response.status).toBe(404);
    expect(m.assignSteward).not.toHaveBeenCalled();
    expect(m.requestAssignmentConvergence).not.toHaveBeenCalled();
    expect(m.processAssignmentConvergence).not.toHaveBeenCalled();
    expect(m.tx.update).not.toHaveBeenCalled();
  });

  it('assigns the steward in the organization transaction, updates unionRepId, and records + processes a convergence task', async () => {
    const { PATCH } = await loadRoute();
    const response = await PATCH(assignRequest());
    expect(response.status).toBe(200);

    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org_1' }, expect.any(Function));
    expect(m.assignSteward).toHaveBeenCalledWith('org_1', GRIEVANCE, NEW_STEWARD_PROFILE, m.tx);
    expect(m.tx.update).toHaveBeenCalled();
    expect(m.requestAssignmentConvergence).toHaveBeenCalledTimes(1);
    expect(m.requestAssignmentConvergence).toHaveBeenCalledWith(
      m.tx,
      expect.objectContaining({
        grievanceId: GRIEVANCE,
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
    expect(m.withSystemContext).toHaveBeenCalledTimes(1);
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(m.tx, expect.objectContaining({ action: 'grievance.assign_steward', organizationId: 'org_1', userId: 'u1', resourceId: GRIEVANCE }));
  });

  it('runs the system-role convergence only after the assignment transaction has committed', async () => {
    const { PATCH } = await loadRoute();
    await PATCH(assignRequest());
    // The system role reads on another connection, where an uncommitted task does not exist.
    expect(m.committedWhenSystemRan).toBe(true);
  });

  it('takes the OUTGOING representative from the kernel, not from the legacy column (a stale legacy value is ignored)', async () => {
    m.tx.select = vi.fn(() => ({
      from: vi.fn(() => ({ where: vi.fn(async () => [{ id: GRIEVANCE, unionRepId: 'stale-legacy-value' }]) })),
    }));
    m.assignPrimaryRepresentative.mockResolvedValue({ previousUserId: 'officer-OLD' });
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
    expect(m.committedWhenSystemRan).toBe(true);
  });

  it('handles a grievance with no prior representative (previousAssigneeId is null)', async () => {
    m.assignPrimaryRepresentative.mockResolvedValue({ previousUserId: null });
    const { PATCH } = await loadRoute();
    const response = await PATCH(assignRequest());
    expect(response.status).toBe(200);
    expect(m.requestAssignmentConvergence).toHaveBeenCalledWith(
      m.tx,
      expect.objectContaining({ previousAssigneeId: null, newAssigneeId: NEW_STEWARD }),
    );
  });

  it('asks the kernel to assign as the authenticated officer, inside the same transaction', async () => {
    const { PATCH } = await loadRoute();
    await PATCH(assignRequest());
    expect(m.assignPrimaryRepresentative).toHaveBeenCalledWith(m.tx, {
      organizationId: 'org_1', grievanceId: GRIEVANCE, issuerUserId: 'u1', assigneeUserId: NEW_STEWARD,
    });
  });

  it('is refused with 403 when the kernel does not authorize it, and nothing is written', async () => {
    const { AuthorityStoreError } = await import('@/lib/authority/store/executor');
    m.assignPrimaryRepresentative.mockRejectedValueOnce(new AuthorityStoreError('DENIED', 'NO_SOURCE_OF_AUTHORITY'));
    const { PATCH } = await loadRoute();
    const response = await PATCH(assignRequest());
    expect(response.status).toBe(403);
    expect(m.tx.update).not.toHaveBeenCalled();
    expect(m.requestAssignmentConvergence).not.toHaveBeenCalled();
    expect(m.processAssignmentConvergence).not.toHaveBeenCalled();
  });
});
