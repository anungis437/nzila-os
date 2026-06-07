import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockLimit: vi.fn(),
  mockInsert: vi.fn(),
  mockValues: vi.fn(),
  mockReturning: vi.fn(),
  mockUpdate: vi.fn(),
  mockSet: vi.fn(),
  rrulestr: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {
    select: mocks.mockSelect.mockReturnValue({
      from: mocks.mockFrom.mockReturnValue({
        where: mocks.mockWhere.mockReturnValue({
          limit: mocks.mockLimit,
        }),
      }),
    }),
    insert: mocks.mockInsert.mockReturnValue({
      values: mocks.mockValues.mockReturnValue({
        returning: mocks.mockReturning,
      }),
    }),
    update: mocks.mockUpdate.mockReturnValue({
      set: mocks.mockSet.mockReturnValue({
        where: mocks.mockWhere,
      }),
    }),
  },
}));

vi.mock('@/db/schema/calendar-schema', () => ({
  calendarEvents: { id: 'id', parentEventId: 'parentEventId', startTime: 'startTime', status: 'status' },
  eventAttendees: { eventId: 'eventId' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...a: any[]) => a),
  and: vi.fn((...a: any[]) => a),
  gte: vi.fn((...a: any[]) => a),
  lte: vi.fn((...a: any[]) => a),
  relations: vi.fn(() => ({})),
}));

vi.mock('rrule', () => ({
  rrulestr: mocks.rrulestr,
}));

import {
  generateRRule,
  parseRRule,
  getRecurrenceDescription,
  generateRecurringInstances,
} from '../recurring-events-service';

describe('recurring-events-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateRRule', () => {
    it('generates basic weekly RRULE', () => {
      const rule = generateRRule({ frequency: 'WEEKLY' });
      expect(rule).toBe('FREQ=WEEKLY');
    });

    it('includes interval when > 1', () => {
      const rule = generateRRule({ frequency: 'DAILY', interval: 3 });
      expect(rule).toContain('INTERVAL=3');
    });

    it('includes COUNT', () => {
      const rule = generateRRule({ frequency: 'MONTHLY', count: 12 });
      expect(rule).toContain('COUNT=12');
    });

    it('includes UNTIL as formatted date', () => {
      const until = new Date('2026-12-31T00:00:00Z');
      const rule = generateRRule({ frequency: 'YEARLY', until });
      expect(rule).toContain('UNTIL=');
      expect(rule).toContain('Z');
    });

    it('includes BYDAY', () => {
      const rule = generateRRule({ frequency: 'WEEKLY', byDay: ['MO', 'WE', 'FR'] });
      expect(rule).toContain('BYDAY=MO,WE,FR');
    });

    it('includes BYMONTHDAY', () => {
      const rule = generateRRule({ frequency: 'MONTHLY', byMonthDay: [1, 15] });
      expect(rule).toContain('BYMONTHDAY=1,15');
    });

    it('includes BYMONTH', () => {
      const rule = generateRRule({ frequency: 'YEARLY', byMonth: [6, 12] });
      expect(rule).toContain('BYMONTH=6,12');
    });
  });

  describe('parseRRule', () => {
    it('parses FREQ', () => {
      const opts = parseRRule('FREQ=DAILY');
      expect(opts.frequency).toBe('DAILY');
    });

    it('parses INTERVAL', () => {
      const opts = parseRRule('FREQ=WEEKLY;INTERVAL=2');
      expect(opts.interval).toBe(2);
    });

    it('parses COUNT', () => {
      const opts = parseRRule('FREQ=MONTHLY;COUNT=10');
      expect(opts.count).toBe(10);
    });

    it('parses BYDAY', () => {
      const opts = parseRRule('FREQ=WEEKLY;BYDAY=TU,TH');
      expect(opts.byDay).toEqual(['TU', 'TH']);
    });
  });

  describe('getRecurrenceDescription', () => {
    it('returns human-readable text from rrulestr', () => {
      mocks.rrulestr.mockReturnValue({ toText: () => 'every week on Monday' });
      expect(getRecurrenceDescription('RRULE:FREQ=WEEKLY;BYDAY=MO')).toBe('every week on Monday');
    });

    it('returns fallback on parse error', () => {
      mocks.rrulestr.mockImplementation(() => { throw new Error('parse error'); });
      expect(getRecurrenceDescription('INVALID')).toBe('Custom recurrence');
    });
  });

  describe('generateRecurringInstances', () => {
    it('generates instances within date range', () => {
      const start = new Date('2026-01-01');
      const end = new Date('2026-01-31');
      const baseEvent = {
        id: 'evt-1',
        startTime: '2026-01-01T10:00:00Z',
        endTime: '2026-01-01T11:00:00Z',
        timezone: 'America/New_York',
      };

      const mockRule = {
        between: vi.fn().mockReturnValue([
          new Date('2026-01-07T10:00:00Z'),
          new Date('2026-01-14T10:00:00Z'),
        ]),
      };
      mocks.rrulestr.mockReturnValue(mockRule);

      const instances = generateRecurringInstances(baseEvent, 'FREQ=WEEKLY', start, end);

      expect(instances).toHaveLength(2);
      expect(instances[0].parentEventId).toBe('evt-1');
    });

    it('filters out exception dates', () => {
      const start = new Date('2026-01-01');
      const end = new Date('2026-01-31');
      const baseEvent = {
        id: 'evt-1',
        startTime: '2026-01-01T10:00:00Z',
        endTime: '2026-01-01T11:00:00Z',
      };

      const mockRule = {
        between: vi.fn().mockReturnValue([
          new Date('2026-01-07T10:00:00Z'),
          new Date('2026-01-14T10:00:00Z'),
        ]),
      };
      mocks.rrulestr.mockReturnValue(mockRule);

      const instances = generateRecurringInstances(
        baseEvent, 'FREQ=WEEKLY', start, end, ['2026-01-07'],
      );

      expect(instances).toHaveLength(1);
    });

    it('returns empty array on error', () => {
      mocks.rrulestr.mockImplementation(() => { throw new Error('parse'); });

      const result = generateRecurringInstances(
        { id: 'e', startTime: 'bad', endTime: 'bad' },
        'INVALID', new Date(), new Date(),
      );
      expect(result).toEqual([]);
    });
  });
});
