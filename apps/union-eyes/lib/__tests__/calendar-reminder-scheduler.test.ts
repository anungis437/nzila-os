import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockLimit: vi.fn(),
  mockValues: vi.fn(),
  mockReturning: vi.fn(),
  mockAddNotificationJob: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {
    select: mocks.mockSelect.mockReturnValue({
      from: mocks.mockFrom.mockReturnValue({
        where: mocks.mockWhere.mockReturnValue({
          limit: mocks.mockLimit.mockResolvedValue([]),
        }),
      }),
    }),
    insert: mocks.mockInsert.mockReturnValue({
      values: mocks.mockValues.mockReturnValue({
        returning: mocks.mockReturning.mockResolvedValue([{ id: 'rem-1' }]),
      }),
    }),
  },
}));

vi.mock('@/db/schema/calendar-schema', () => ({
  calendarEvents: { id: 'id' },
  eventAttendees: { eventId: 'eventId', status: 'status' },
  eventReminders: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...a: unknown[]) => a),
  and: vi.fn((...a: unknown[]) => a),
  lte: vi.fn((...a: unknown[]) => a),
  gte: vi.fn((...a: unknown[]) => a),
  isNull: vi.fn((...a: unknown[]) => a),
  relations: vi.fn(() => ({})),
}));

vi.mock('date-fns', () => ({
  subMinutes: vi.fn((d: Date, m: number) => new Date(d.getTime() - m * 60000)),
  subDays: vi.fn((d: Date, days: number) => new Date(d.getTime() - days * 86400000)),
  addMinutes: vi.fn((d: Date, m: number) => new Date(d.getTime() + m * 60000)),
}));

vi.mock('@/lib/job-queue', () => ({
  addNotificationJob: mocks.mockAddNotificationJob.mockResolvedValue(undefined),
}));

describe('calendar-reminder-scheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports REMINDER_PRESETS with expected values', async () => {
    const { REMINDER_PRESETS } = await import('../calendar-reminder-scheduler');
    expect(REMINDER_PRESETS.FIFTEEN_MINUTES).toBe(15);
    expect(REMINDER_PRESETS.ONE_HOUR).toBe(60);
    expect(REMINDER_PRESETS.ONE_DAY).toBe(1440);
    expect(REMINDER_PRESETS.ONE_WEEK).toBe(10080);
  });

  it('scheduleEventReminders throws when event not found', async () => {
    mocks.mockLimit.mockResolvedValue([]);
    const { scheduleEventReminders } = await import('../calendar-reminder-scheduler');
    await expect(scheduleEventReminders('missing-event')).rejects.toThrow('Event not found');
  });

  it('scheduleEventReminders returns 0 when no attendees', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 7);
    // First select: event, second select: attendees
    mocks.mockSelect
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: 'evt-1',
              startTime: futureDate.toISOString(),
              reminders: [15],
            }]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

    const { scheduleEventReminders } = await import('../calendar-reminder-scheduler');
    const count = await scheduleEventReminders('evt-1');
    expect(count).toBe(0);
  });
});
