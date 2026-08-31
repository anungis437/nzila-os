import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  scheduleGrievanceDeadlineReminders: vi.fn(),
  audit: vi.fn(),
}));

vi.mock('@/db', () => ({ db: { select: mocks.select } }));
vi.mock('@/db/schema', () => ({
  grievanceDeadlines: { id: 'id', grievanceId: 'grievanceId', status: 'status', dueDate: 'dueDate', reminderDays: 'reminderDays' },
}));
vi.mock('drizzle-orm', () => ({
  and: (...conds: unknown[]) => ({ and: conds }),
  eq: (col: unknown, val: unknown) => ({ eq: [col, val] }),
  ne: (col: unknown, val: unknown) => ({ ne: [col, val] }),
}));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../reminder-scheduler', () => ({ scheduleGrievanceDeadlineReminders: mocks.scheduleGrievanceDeadlineReminders }));
vi.mock('../audit', () => ({ writeDeadlineAuditEvent: mocks.audit }));

import { refreshDeadlineRemindersForGrievance } from '../assignment-sync';

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
