import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Reminder scheduler unit tests.
 *
 * The scheduler's job:
 *  1. Resolve recipients (external dep — mocked).
 *  2. In a single transaction: cancel existing pending rows, insert new
 *     rows (one per recipient×offset), rely on ON CONFLICT DO NOTHING to
 *     make retries idempotent.
 *  3. Emit audit events for every row it touched (never silent).
 *
 * These tests mock the DB transaction API and the audit writer to prove
 * the code path — actual concurrency-safety (unique-index race, FOR
 * UPDATE) is covered by the live D1 scenario in staging.
 */

const mocks = vi.hoisted(() => ({
  resolve: vi.fn(),
  audit: vi.fn(),
  txExecute: vi.fn(),
}));

vi.mock('../recipient-resolver', () => ({
  resolveGrievanceDeadlineRecipients: mocks.resolve,
}));
vi.mock('../audit', () => ({
  writeDeadlineAuditEvent: mocks.audit,
}));

vi.mock('@/db', () => ({
  db: {
    transaction: vi.fn(async (fn: (tx: { execute: typeof mocks.txExecute }) => Promise<void>) => {
      return fn({ execute: mocks.txExecute });
    }),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('drizzle-orm', () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
}));

import { scheduleGrievanceDeadlineReminders } from '../reminder-scheduler';

const ORG = '00000000-0000-0000-0000-000000000010';
const GRIEV = '00000000-0000-0000-0000-000000000020';
const DL = '00000000-0000-0000-0000-000000000030';

const NOW = new Date('2026-08-01T12:00:00.000Z');
const FUTURE_DUE = new Date(NOW.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days out

beforeEach(() => {
  vi.clearAllMocks();
  vi.setSystemTime(NOW);
});

describe('reminder-scheduler', () => {
  it('rejects an empty offsets list', async () => {
    await expect(
      scheduleGrievanceDeadlineReminders({
        sourceDeadlineId: DL,
        grievanceId: GRIEV,
        dueDate: FUTURE_DUE,
        reminderOffsetsInDays: [],
      }),
    ).rejects.toThrow(/must be non-empty/);
    expect(mocks.resolve).not.toHaveBeenCalled();
  });

  it('when no recipients resolve: writes audit event and returns empty scheduled list', async () => {
    mocks.resolve.mockResolvedValueOnce({
      organizationId: ORG,
      recipients: [],
      skipped: [{ role: 'grievor', reason: 'no email' }],
    });
    const result = await scheduleGrievanceDeadlineReminders({
      sourceDeadlineId: DL,
      grievanceId: GRIEV,
      dueDate: FUTURE_DUE,
      reminderOffsetsInDays: [3, 1],
    });
    expect(result.scheduled).toEqual([]);
    expect(result.cancelledForReschedule).toEqual([]);
    expect(mocks.txExecute).not.toHaveBeenCalled();
    // one audit event with outcome=no_recipients
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'deadline.created',
        metadata: expect.objectContaining({ outcome: 'no_recipients' }),
      }),
    );
  });

  it('cancels prior pending rows then inserts one row per (recipient x offset)', async () => {
    mocks.resolve.mockResolvedValueOnce({
      organizationId: ORG,
      recipients: [
        { userId: 'u-1', role: 'grievor', email: 'a@example.com', locale: 'en' },
        { userId: 'u-2', role: 'assigned_officer', email: 'b@example.com', locale: 'en' },
      ],
      skipped: [],
    });

    // Tx execute sequence: (1) cancel returns 2 prior rows; (2..) insert returns 1 row each.
    mocks.txExecute
      .mockResolvedValueOnce([{ id: 'cancel-1' }, { id: 'cancel-2' }]) // cancel
      .mockResolvedValueOnce([
        { id: 'r-a-3', scheduled_for: '2026-08-28T12:00:00Z', offset_days: 3, recipient_role: 'grievor', recipient_email_hash: 'ha' },
      ]) // insert grievor offset=3
      .mockResolvedValueOnce([
        { id: 'r-b-3', scheduled_for: '2026-08-28T12:00:00Z', offset_days: 3, recipient_role: 'assigned_officer', recipient_email_hash: 'hb' },
      ]) // insert officer offset=3
      .mockResolvedValueOnce([
        { id: 'r-a-1', scheduled_for: '2026-08-30T12:00:00Z', offset_days: 1, recipient_role: 'grievor', recipient_email_hash: 'ha' },
      ]) // insert grievor offset=1
      .mockResolvedValueOnce([
        { id: 'r-b-1', scheduled_for: '2026-08-30T12:00:00Z', offset_days: 1, recipient_role: 'assigned_officer', recipient_email_hash: 'hb' },
      ]); // insert officer offset=1

    const result = await scheduleGrievanceDeadlineReminders({
      sourceDeadlineId: DL,
      grievanceId: GRIEV,
      dueDate: FUTURE_DUE,
      reminderOffsetsInDays: [3, 1],
    });

    expect(result.scheduled).toHaveLength(4);
    expect(result.cancelledForReschedule).toEqual(['cancel-1', 'cancel-2']);
    // 1 cancel query + 4 insert queries = 5 tx.execute calls
    expect(mocks.txExecute).toHaveBeenCalledTimes(5);
    const firstInsertSql = mocks.txExecute.mock.calls[1]?.[0]?.strings.join(' ').replace(/\s+/g, ' ');
    expect(firstInsertSql).toContain(
      "on conflict (source_deadline_id, recipient_email_hash, offset_days, reminder_kind) where status = 'pending'",
    );
    expect(firstInsertSql).not.toContain('on constraint deadline_reminders_pending_uidx');

    // Audit events: 2 cancellations + 4 scheduled + 1 summary (rescheduled because cancelledIds > 0)
    const eventTypes = mocks.audit.mock.calls.map(([arg]) => arg.eventType).sort();
    expect(eventTypes.filter((t) => t === 'reminder.cancelled_reschedule')).toHaveLength(2);
    expect(eventTypes.filter((t) => t === 'reminder.scheduled')).toHaveLength(4);
    expect(eventTypes.filter((t) => t === 'deadline.rescheduled')).toHaveLength(1);
    expect(eventTypes).not.toContain('deadline.created'); // rescheduled took priority
  });

  it('emits deadline.created (not rescheduled) when no prior rows existed', async () => {
    mocks.resolve.mockResolvedValueOnce({
      organizationId: ORG,
      recipients: [{ userId: 'u-1', role: 'grievor', email: 'a@example.com', locale: 'en' }],
      skipped: [],
    });
    mocks.txExecute
      .mockResolvedValueOnce([]) // cancel returns no prior rows
      .mockResolvedValueOnce([
        { id: 'r-1', scheduled_for: '2026-08-30T12:00:00Z', offset_days: 1, recipient_role: 'grievor', recipient_email_hash: 'ha' },
      ]);

    const result = await scheduleGrievanceDeadlineReminders({
      sourceDeadlineId: DL,
      grievanceId: GRIEV,
      dueDate: FUTURE_DUE,
      reminderOffsetsInDays: [1],
    });

    expect(result.cancelledForReschedule).toEqual([]);
    const eventTypes = mocks.audit.mock.calls.map(([arg]) => arg.eventType);
    expect(eventTypes).toContain('deadline.created');
    expect(eventTypes).not.toContain('deadline.rescheduled');
  });

  it('skips offsets whose scheduled_for is in the past (never schedules stale reminders)', async () => {
    mocks.resolve.mockResolvedValueOnce({
      organizationId: ORG,
      recipients: [{ userId: 'u-1', role: 'grievor', email: 'a@example.com', locale: 'en' }],
      skipped: [],
    });
    // Cancel query only (no inserts because all offsets are in the past)
    mocks.txExecute.mockResolvedValueOnce([]);

    // dueDate is 2 days out; offset=5 → 3 days in the past
    const nearDue = new Date(NOW.getTime() + 2 * 24 * 60 * 60 * 1000);
    const result = await scheduleGrievanceDeadlineReminders({
      sourceDeadlineId: DL,
      grievanceId: GRIEV,
      dueDate: nearDue,
      reminderOffsetsInDays: [5],
    });

    expect(result.scheduled).toEqual([]);
    expect(result.skippedInPast).toHaveLength(1);
    expect(result.skippedInPast[0].offsetDays).toBe(5);
    // Only the cancel query — no insert executed
    expect(mocks.txExecute).toHaveBeenCalledTimes(1);
  });

  it('when unique-index race causes ON CONFLICT DO NOTHING: no duplicate row appears in result', async () => {
    mocks.resolve.mockResolvedValueOnce({
      organizationId: ORG,
      recipients: [{ userId: 'u-1', role: 'grievor', email: 'a@example.com', locale: 'en' }],
      skipped: [],
    });
    // Cancel returns nothing; INSERT returns empty array (conflict happened)
    mocks.txExecute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]); // insert with conflict returns nothing

    const result = await scheduleGrievanceDeadlineReminders({
      sourceDeadlineId: DL,
      grievanceId: GRIEV,
      dueDate: FUTURE_DUE,
      reminderOffsetsInDays: [1],
    });

    expect(result.scheduled).toEqual([]);
    // Only the deadline.created summary event — no reminder.scheduled
    const eventTypes = mocks.audit.mock.calls.map(([arg]) => arg.eventType);
    expect(eventTypes).not.toContain('reminder.scheduled');
  });

  it('propagates recipient-resolver errors (never silent)', async () => {
    mocks.resolve.mockRejectedValueOnce(new Error('grievance not found'));
    await expect(
      scheduleGrievanceDeadlineReminders({
        sourceDeadlineId: DL,
        grievanceId: GRIEV,
        dueDate: FUTURE_DUE,
        reminderOffsetsInDays: [1],
      }),
    ).rejects.toThrow(/grievance not found/);
    expect(mocks.txExecute).not.toHaveBeenCalled();
  });
});
