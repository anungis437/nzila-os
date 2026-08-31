import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  scheduleGrievanceDeadlineReminders: vi.fn(),
  audit: vi.fn(),
}));

vi.mock('@/db', () => ({ db: { select: mocks.select, insert: mocks.insert, update: mocks.update } }));
vi.mock('@/db/schema', () => ({
  grievanceDeadlines: { id: 'id', grievanceId: 'grievanceId', status: 'status', dueDate: 'dueDate', reminderDays: 'reminderDays' },
  deadlineReassignmentConvergence: {
    id: 'id',
    organizationId: 'organizationId',
    grievanceId: 'grievanceId',
    status: 'status',
    attemptCount: 'attemptCount',
  },
}));
vi.mock('drizzle-orm', () => ({
  and: (...conds: unknown[]) => ({ and: conds }),
  eq: (col: unknown, val: unknown) => ({ eq: [col, val] }),
  ne: (col: unknown, val: unknown) => ({ ne: [col, val] }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
}));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../reminder-scheduler', () => ({ scheduleGrievanceDeadlineReminders: mocks.scheduleGrievanceDeadlineReminders }));
vi.mock('../audit', () => ({ writeDeadlineAuditEvent: mocks.audit }));

import {
  refreshDeadlineRemindersForGrievance,
  requestAssignmentConvergence,
  processAssignmentConvergence,
  sweepPendingAssignmentConvergence,
} from '../assignment-sync';

const ORG = '00000000-0000-0000-0000-000000000010';
const GRIEV = '00000000-0000-0000-0000-000000000020';

function mockActiveDeadlines(rows: Array<{ id: string; dueDate: Date; reminderDays: number[] | null }>) {
  mocks.select.mockReturnValueOnce({
    from: vi.fn(() => ({
      where: vi.fn(async () => rows),
    })),
  });
}

describe('assignment-sync: refreshDeadlineRemindersForGrievance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.scheduleGrievanceDeadlineReminders.mockResolvedValue({
      correlationId: 'c-1', scheduled: [], cancelledForReschedule: [], skipped: [], skippedInPast: [],
    });
  });

  it('reschedules every non-completed deadline for the grievance and emits a refresh audit event per deadline', async () => {
    mockActiveDeadlines([
      { id: 'dl-1', dueDate: new Date('2026-09-01T00:00:00.000Z'), reminderDays: [7, 3, 1] },
      { id: 'dl-2', dueDate: new Date('2026-09-15T00:00:00.000Z'), reminderDays: null },
    ]);

    const result = await refreshDeadlineRemindersForGrievance({
      grievanceId: GRIEV,
      organizationId: ORG,
      correlationId: 'refresh-1',
      actor: { type: 'user', id: 'officer-B' },
      reason: 'assignment_changed',
      previousAssigneeId: 'officer-A',
      newAssigneeId: 'officer-B',
    });

    expect(result.refreshedDeadlineIds).toEqual(['dl-1', 'dl-2']);
    expect(result.failedDeadlineIds).toEqual([]);
    expect(mocks.scheduleGrievanceDeadlineReminders).toHaveBeenCalledTimes(2);
    expect(mocks.scheduleGrievanceDeadlineReminders).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ sourceDeadlineId: 'dl-1', grievanceId: GRIEV, reminderOffsetsInDays: [7, 3, 1] }),
    );
    // Falls back to the default schedule when reminderDays is null.
    expect(mocks.scheduleGrievanceDeadlineReminders).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ sourceDeadlineId: 'dl-2', reminderOffsetsInDays: [7, 3, 1] }),
    );

    expect(mocks.audit).toHaveBeenCalledTimes(2);
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceDeadlineId: 'dl-1',
        eventType: 'reminder.recipients_refreshed',
        metadata: expect.objectContaining({
          reason: 'assignment_changed',
          previous_assignee_id: 'officer-A',
          new_assignee_id: 'officer-B',
        }),
      }),
    );
  });

  it('does not touch completed deadlines (query excludes them)', async () => {
    mockActiveDeadlines([]); // simulates the ne(status, 'completed') filter excluding everything
    const result = await refreshDeadlineRemindersForGrievance({
      grievanceId: GRIEV,
      organizationId: ORG,
      correlationId: 'refresh-2',
      actor: { type: 'user', id: 'officer-B' },
      reason: 'assignment_changed',
    });
    expect(result.refreshedDeadlineIds).toEqual([]);
    expect(mocks.scheduleGrievanceDeadlineReminders).not.toHaveBeenCalled();
  });

  it('throws (fail-loud, never silent) when a deadline fails to reschedule', async () => {
    mockActiveDeadlines([{ id: 'dl-err', dueDate: new Date('2026-09-01T00:00:00.000Z'), reminderDays: [1] }]);
    mocks.scheduleGrievanceDeadlineReminders.mockRejectedValueOnce(new Error('recipient resolution failed'));

    await expect(
      refreshDeadlineRemindersForGrievance({
        grievanceId: GRIEV,
        organizationId: ORG,
        correlationId: 'refresh-3',
        actor: { type: 'user', id: 'officer-B' },
        reason: 'assignment_changed',
      }),
    ).rejects.toThrow(/failed to refresh reminders/);

    expect(mocks.audit).not.toHaveBeenCalled();
  });
});

function mockConvergenceTaskLoad(task: Record<string, unknown> | undefined) {
  mocks.select.mockReturnValueOnce({
    from: vi.fn(() => ({
      where: vi.fn(async () => (task ? [task] : [])),
    })),
  });
}

function mockConvergenceInsert(taskId: string) {
  return {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(async () => [{ id: taskId }]),
      })),
    })),
  };
}

function baseTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    organizationId: ORG,
    grievanceId: GRIEV,
    previousAssigneeId: 'officer-A',
    newAssigneeId: 'officer-B',
    status: 'pending',
    correlationId: 'refresh-task-1',
    ...overrides,
  };
}

describe('assignment-sync: requestAssignmentConvergence', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts a durable pending task using the caller-supplied tx and returns its id', async () => {
    const tx = mockConvergenceInsert('task-abc') as unknown as Parameters<typeof requestAssignmentConvergence>[0];
    const result = await requestAssignmentConvergence(tx, {
      organizationId: ORG,
      grievanceId: GRIEV,
      correlationId: 'refresh-1',
      previousAssigneeId: 'officer-A',
      newAssigneeId: 'officer-B',
    });
    expect(result.taskId).toBe('task-abc');
  });

  it('throws if the insert returns no row', async () => {
    const tx = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({ returning: vi.fn(async () => []) })),
      })),
    } as unknown as Parameters<typeof requestAssignmentConvergence>[0];
    await expect(
      requestAssignmentConvergence(tx, {
        organizationId: ORG,
        grievanceId: GRIEV,
        correlationId: 'refresh-1',
        newAssigneeId: 'officer-B',
      }),
    ).rejects.toThrow(/failed to insert convergence task/);
  });
});

describe('assignment-sync: processAssignmentConvergence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.scheduleGrievanceDeadlineReminders.mockResolvedValue({
      correlationId: 'c-1', scheduled: [], cancelledForReschedule: [], skipped: [], skippedInPast: [],
    });
    mocks.update.mockReturnValue({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) });
  });

  it('is idempotent: a task already converged is a no-op that does not re-run the scheduler', async () => {
    mockConvergenceTaskLoad(baseTask({ status: 'converged' }));
    const result = await processAssignmentConvergence('task-1');
    expect(result).toEqual({ taskId: 'task-1', converged: true, refreshedDeadlineIds: [] });
    expect(mocks.scheduleGrievanceDeadlineReminders).not.toHaveBeenCalled();
  });

  it('throws if the task does not exist', async () => {
    mockConvergenceTaskLoad(undefined);
    await expect(processAssignmentConvergence('missing-task')).rejects.toThrow(/not found/);
  });

  it('converges a pending task: reschedules every active deadline and marks it converged', async () => {
    mockConvergenceTaskLoad(baseTask());
    mockActiveDeadlines([{ id: 'dl-1', dueDate: new Date('2026-09-01T00:00:00.000Z'), reminderDays: [7, 3, 1] }]);

    const result = await processAssignmentConvergence('task-1', { type: 'worker', id: null });
    expect(result.converged).toBe(true);
    expect(result.refreshedDeadlineIds).toEqual(['dl-1']);
    expect(mocks.update).toHaveBeenCalled();
  });

  it('on failure, leaves the task pending (never terminal) with the error recorded, and rethrows', async () => {
    mockConvergenceTaskLoad(baseTask());
    mockActiveDeadlines([{ id: 'dl-err', dueDate: new Date('2026-09-01T00:00:00.000Z'), reminderDays: [1] }]);
    mocks.scheduleGrievanceDeadlineReminders.mockRejectedValueOnce(new Error('scheduler unavailable'));

    let setArgs: Record<string, unknown> | undefined;
    mocks.update.mockReturnValueOnce({
      set: vi.fn((args: Record<string, unknown>) => {
        setArgs = args;
        return { where: vi.fn(async () => undefined) };
      }),
    });

    await expect(processAssignmentConvergence('task-1')).rejects.toThrow(/failed to refresh reminders/);
    expect(setArgs?.status).toBe('pending');
    expect(setArgs?.lastError).toMatch(/failed to refresh reminders/);
  });
});

describe('assignment-sync: sweepPendingAssignmentConvergence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.scheduleGrievanceDeadlineReminders.mockResolvedValue({
      correlationId: 'c-1', scheduled: [], cancelledForReschedule: [], skipped: [], skippedInPast: [],
    });
    mocks.update.mockReturnValue({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) });
  });

  it('retries every pending task and converges the ones that now succeed', async () => {
    // 1. list of pending task ids
    mocks.select.mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit: vi.fn(async () => [{ id: 'task-1' }]) })),
      })),
    });
    // 2. processAssignmentConvergence('task-1') loads the full task row
    mockConvergenceTaskLoad(baseTask());
    // 3. processAssignmentConvergence's internal refresh loads active deadlines
    mockActiveDeadlines([{ id: 'dl-1', dueDate: new Date('2026-09-01T00:00:00.000Z'), reminderDays: [1] }]);

    const result = await sweepPendingAssignmentConvergence();
    expect(result).toEqual({ examined: 1, converged: 1, stillPending: 0 });
  });

  it('never throws: a task that still fails remains pending for the next sweep', async () => {
    mocks.select.mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit: vi.fn(async () => [{ id: 'task-1' }]) })),
      })),
    });
    mockConvergenceTaskLoad(baseTask());
    mockActiveDeadlines([{ id: 'dl-1', dueDate: new Date('2026-09-01T00:00:00.000Z'), reminderDays: [1] }]);
    mocks.scheduleGrievanceDeadlineReminders.mockRejectedValueOnce(new Error('still down'));

    const result = await sweepPendingAssignmentConvergence();
    expect(result).toEqual({ examined: 1, converged: 0, stillPending: 1 });
  });

  it('is a no-op when there are no pending tasks', async () => {
    mocks.select.mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit: vi.fn(async () => []) })),
      })),
    });
    const result = await sweepPendingAssignmentConvergence();
    expect(result).toEqual({ examined: 0, converged: 0, stillPending: 0 });
    expect(mocks.scheduleGrievanceDeadlineReminders).not.toHaveBeenCalled();
  });
});
