import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockAddNotificationJob: vi.fn().mockResolvedValue(undefined),
  mockGetNotificationQueue: vi.fn(),
  mockDb: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

function chain(resolveValue: any): any {
  const handler: ProxyHandler<object> = {
    get: (_target, prop) => {
      if (prop === 'then') return (resolve: (v: any) => void) => resolve(resolveValue);
      return vi.fn(() => new Proxy({}, handler));
    },
  };
  return new Proxy({}, handler);
}

vi.mock('@/db/db', () => ({ db: mocks.mockDb }));

vi.mock('@/db/schema/calendar-schema', () => ({
  calendarEvents: { id: 'id', parentEventId: 'parentEventId', startTime: 'startTime' },
  eventAttendees: { eventId: 'eventId', userId: 'userId', status: 'status' },
  eventReminders: {
    id: 'id', eventId: 'eventId', status: 'status',
    scheduledFor: 'scheduledFor', sentAt: 'sentAt', createdAt: 'createdAt',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...a: any[]) => a),
  and: vi.fn((...a: any[]) => a),
  lte: vi.fn((...a: any[]) => a),
  gte: vi.fn((...a: any[]) => a),
  isNull: vi.fn((...a: any[]) => a),
  relations: vi.fn(() => ({})),
}));

vi.mock('date-fns', () => ({
  subMinutes: vi.fn((d: Date, m: number) => new Date(d.getTime() - m * 60000)),
  subDays: vi.fn((d: Date, days: number) => new Date(d.getTime() - days * 86400000)),
  addMinutes: vi.fn((d: Date, m: number) => new Date(d.getTime() + m * 60000)),
}));

vi.mock('@/lib/job-queue', () => ({
  addNotificationJob: mocks.mockAddNotificationJob,
  getNotificationQueue: mocks.mockGetNotificationQueue,
}));

import {
  REMINDER_PRESETS,
  scheduleEventReminders,
  cancelEventReminders,
  rescheduleEventReminders,
  scheduleRecurringEventReminders,
  markReminderSent,
  getPendingReminders,
  retryFailedReminders,
  cleanupOldReminders,
  getReminderStats,
} from '../calendar-reminder-scheduler';

describe('calendar-reminder-scheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockGetNotificationQueue.mockReturnValue(null);
  });

  // ── REMINDER_PRESETS ───────────────────────────────────────────────────────
  describe('REMINDER_PRESETS', () => {
    it('has correct values', () => {
      expect(REMINDER_PRESETS.AT_TIME).toBe(0);
      expect(REMINDER_PRESETS.FIFTEEN_MINUTES).toBe(15);
      expect(REMINDER_PRESETS.THIRTY_MINUTES).toBe(30);
      expect(REMINDER_PRESETS.ONE_HOUR).toBe(60);
      expect(REMINDER_PRESETS.TWO_HOURS).toBe(120);
      expect(REMINDER_PRESETS.ONE_DAY).toBe(1440);
      expect(REMINDER_PRESETS.TWO_DAYS).toBe(2880);
      expect(REMINDER_PRESETS.ONE_WEEK).toBe(10080);
    });
  });

  // ── scheduleEventReminders ─────────────────────────────────────────────────
  describe('scheduleEventReminders', () => {
    it('throws when event not found', async () => {
      mocks.mockDb.select.mockReturnValue(chain([]));
      await expect(scheduleEventReminders('missing')).rejects.toThrow('Event not found');
    });

    it('returns 0 when no attendees', async () => {
      const futureDate = new Date(Date.now() + 86400000 * 7);
      mocks.mockDb.select
        .mockReturnValueOnce(chain([{ id: 'evt-1', startTime: futureDate.toISOString(), reminders: [15], organizationId: 'org-1' }]))
        .mockReturnValueOnce(chain([]));
      const count = await scheduleEventReminders('evt-1');
      expect(count).toBe(0);
    });

    it('schedules reminders for attendees', async () => {
      const futureDate = new Date(Date.now() + 86400000 * 7);
      mocks.mockDb.select
        .mockReturnValueOnce(chain([{
          id: 'evt-1', title: 'Meeting', startTime: futureDate.toISOString(),
          reminders: [15], organizationId: 'org-1', location: 'Room A', meetingUrl: null,
        }]))
        .mockReturnValueOnce(chain([{ userId: 'user-1', email: 'a@test.com', status: 'accepted' }]));
      mocks.mockDb.insert.mockReturnValue(chain([{ id: 'rem-1' }]));

      const count = await scheduleEventReminders('evt-1', { channels: ['email'] });
      expect(count).toBe(1);
      expect(mocks.mockAddNotificationJob).toHaveBeenCalledTimes(1);
    });

    it('skips declined attendees', async () => {
      const futureDate = new Date(Date.now() + 86400000 * 7);
      mocks.mockDb.select
        .mockReturnValueOnce(chain([{ id: 'evt-1', startTime: futureDate.toISOString(), reminders: [15], organizationId: 'org-1' }]))
        .mockReturnValueOnce(chain([{ userId: 'user-1', status: 'declined' }]));

      const count = await scheduleEventReminders('evt-1');
      expect(count).toBe(0);
      expect(mocks.mockDb.insert).not.toHaveBeenCalled();
    });

    it('uses default [15] when event.reminders is empty', async () => {
      const futureDate = new Date(Date.now() + 86400000 * 7);
      mocks.mockDb.select
        .mockReturnValueOnce(chain([{ id: 'evt-1', startTime: futureDate.toISOString(), reminders: [], organizationId: 'org-1' }]))
        .mockReturnValueOnce(chain([{ userId: 'user-1', status: 'accepted' }]));
      mocks.mockDb.insert.mockReturnValue(chain([{ id: 'rem-1' }]));

      const count = await scheduleEventReminders('evt-1', { channels: ['email'] });
      expect(count).toBe(1);
    });

    it('skips reminders in the past', async () => {
      const pastDate = new Date(Date.now() - 86400000);
      mocks.mockDb.select
        .mockReturnValueOnce(chain([{ id: 'evt-1', startTime: pastDate.toISOString(), reminders: [15], organizationId: 'org-1' }]))
        .mockReturnValueOnce(chain([{ userId: 'user-1', status: 'accepted' }]));

      const count = await scheduleEventReminders('evt-1', { channels: ['email'] });
      expect(count).toBe(0);
      expect(mocks.mockDb.insert).not.toHaveBeenCalled();
    });
  });

  // ── cancelEventReminders ───────────────────────────────────────────────────
  describe('cancelEventReminders', () => {
    it('cancels pending reminders and returns count', async () => {
      mocks.mockDb.select.mockReturnValue(chain([{ id: 'rem-1' }, { id: 'rem-2' }]));
      mocks.mockDb.update.mockReturnValue(chain(undefined));

      const count = await cancelEventReminders('evt-1');
      expect(count).toBe(2);
      expect(mocks.mockDb.update).toHaveBeenCalled();
    });

    it('removes matching jobs from queue', async () => {
      mocks.mockDb.select.mockReturnValue(chain([{ id: 'rem-1' }]));
      mocks.mockDb.update.mockReturnValue(chain(undefined));
      const mockRemove = vi.fn();
      mocks.mockGetNotificationQueue.mockReturnValue({
        getJobs: vi.fn().mockResolvedValue([
          { data: { metadata: { eventId: 'evt-1' } }, remove: mockRemove },
          { data: { metadata: { eventId: 'other' } }, remove: vi.fn() },
        ]),
      });

      const count = await cancelEventReminders('evt-1');
      expect(count).toBe(1);
      expect(mockRemove).toHaveBeenCalled();
    });
  });

  // ── rescheduleEventReminders ───────────────────────────────────────────────
  describe('rescheduleEventReminders', () => {
    it('throws when event not found', async () => {
      mocks.mockDb.select.mockReturnValue(chain([]));
      mocks.mockDb.update.mockReturnValue(chain(undefined));
      await expect(rescheduleEventReminders('evt-1', new Date())).rejects.toThrow('Event not found');
    });

    it('cancels old and schedules new', async () => {
      const newStart = new Date(Date.now() + 86400000 * 14);
      mocks.mockDb.select
        .mockReturnValueOnce(chain([])) // cancelEventReminders: pending reminders
        .mockReturnValueOnce(chain([{ id: 'evt-1', startTime: newStart.toISOString(), reminders: [15], organizationId: 'org-1' }])) // get event
        .mockReturnValueOnce(chain([{ id: 'evt-1', startTime: newStart.toISOString(), reminders: [15], organizationId: 'org-1' }])) // scheduleEventReminders: event
        .mockReturnValueOnce(chain([])); // attendees
      mocks.mockDb.update.mockReturnValue(chain(undefined));

      const count = await rescheduleEventReminders('evt-1', newStart);
      expect(count).toBe(0);
    });
  });

  // ── scheduleRecurringEventReminders ────────────────────────────────────────
  describe('scheduleRecurringEventReminders', () => {
    it('returns 0 when no instances', async () => {
      mocks.mockDb.select.mockReturnValue(chain([]));
      const count = await scheduleRecurringEventReminders('parent-1');
      expect(count).toBe(0);
    });

    it('schedules for each instance', async () => {
      const futureDate = new Date(Date.now() + 86400000 * 7);
      mocks.mockDb.select
        .mockReturnValueOnce(chain([{ id: 'inst-1', startTime: futureDate.toISOString(), reminders: [15], organizationId: 'org-1' }]))
        .mockReturnValueOnce(chain([{ id: 'inst-1', startTime: futureDate.toISOString(), reminders: [15], organizationId: 'org-1' }]))
        .mockReturnValueOnce(chain([]));

      const count = await scheduleRecurringEventReminders('parent-1');
      expect(count).toBe(0);
    });
  });

  // ── markReminderSent ───────────────────────────────────────────────────────
  describe('markReminderSent', () => {
    it('marks as sent by default', async () => {
      mocks.mockDb.update.mockReturnValue(chain(undefined));
      await markReminderSent('rem-1');
      expect(mocks.mockDb.update).toHaveBeenCalled();
    });

    it('marks as failed when success=false', async () => {
      mocks.mockDb.update.mockReturnValue(chain(undefined));
      await markReminderSent('rem-1', false);
      expect(mocks.mockDb.update).toHaveBeenCalled();
    });
  });

  // ── getPendingReminders ────────────────────────────────────────────────────
  describe('getPendingReminders', () => {
    it('returns pending reminders', async () => {
      mocks.mockDb.select.mockReturnValue(chain([{ id: 'rem-1', status: 'pending' }]));
      const result = await getPendingReminders();
      expect(result).toEqual([{ id: 'rem-1', status: 'pending' }]);
    });

    it('accepts limit and lookAheadMinutes', async () => {
      mocks.mockDb.select.mockReturnValue(chain([]));
      const result = await getPendingReminders({ limit: 10, lookAheadMinutes: 30 });
      expect(result).toEqual([]);
    });
  });

  // ── retryFailedReminders ──────────────────────────────────────────────────
  describe('retryFailedReminders', () => {
    it('returns 0 when no failed reminders', async () => {
      mocks.mockDb.select.mockReturnValue(chain([]));
      const count = await retryFailedReminders();
      expect(count).toBe(0);
    });

    it('retries when event and attendee exist', async () => {
      mocks.mockDb.select
        .mockReturnValueOnce(chain([{ id: 'rem-1', eventId: 'evt-1', userId: 'user-1', reminderMinutes: 15, reminderType: 'email' }]))
        .mockReturnValueOnce(chain([{ id: 'evt-1', title: 'Meeting', startTime: new Date().toISOString() }]))
        .mockReturnValueOnce(chain([{ userId: 'user-1', email: 'a@test.com' }]));
      mocks.mockDb.update.mockReturnValue(chain(undefined));

      const count = await retryFailedReminders();
      expect(count).toBe(1);
      expect(mocks.mockAddNotificationJob).toHaveBeenCalled();
    });

    it('skips when event not found', async () => {
      mocks.mockDb.select
        .mockReturnValueOnce(chain([{ id: 'rem-1', eventId: 'evt-gone', userId: 'user-1', reminderMinutes: 15, reminderType: 'email' }]))
        .mockReturnValueOnce(chain([]));

      const count = await retryFailedReminders();
      expect(count).toBe(0);
    });

    it('skips when attendee not found', async () => {
      mocks.mockDb.select
        .mockReturnValueOnce(chain([{ id: 'rem-1', eventId: 'evt-1', userId: 'user-gone', reminderMinutes: 15, reminderType: 'email' }]))
        .mockReturnValueOnce(chain([{ id: 'evt-1' }]))
        .mockReturnValueOnce(chain([]));

      const count = await retryFailedReminders();
      expect(count).toBe(0);
    });
  });

  // ── cleanupOldReminders ────────────────────────────────────────────────────
  describe('cleanupOldReminders', () => {
    it('returns 0 when no old events', async () => {
      mocks.mockDb.select.mockReturnValue(chain([]));
      const count = await cleanupOldReminders();
      expect(count).toBe(0);
    });

    it('deletes reminders for old events', async () => {
      mocks.mockDb.select.mockReturnValue(chain([{ id: 'old-1' }, { id: 'old-2' }]));
      mocks.mockDb.delete.mockReturnValue(chain(undefined));

      const count = await cleanupOldReminders(30);
      expect(count).toBe(2);
      expect(mocks.mockDb.delete).toHaveBeenCalled();
    });
  });

  // ── getReminderStats ───────────────────────────────────────────────────────
  describe('getReminderStats', () => {
    it('counts by status', async () => {
      mocks.mockDb.select.mockReturnValue(chain([
        { status: 'pending' }, { status: 'pending' },
        { status: 'sent' }, { status: 'failed' }, { status: 'cancelled' },
      ]));

      const stats = await getReminderStats();
      expect(stats).toEqual({ pending: 2, sent: 1, failed: 1, cancelled: 1 });
    });

    it('returns zeros when empty', async () => {
      mocks.mockDb.select.mockReturnValue(chain([]));
      const stats = await getReminderStats();
      expect(stats).toEqual({ pending: 0, sent: 0, failed: 0, cancelled: 0 });
    });
  });
});
