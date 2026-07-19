import { describe, it, expect } from 'vitest';
import {
  toUTCISO, parseDate, now, formatForDisplay, formatAsDate,
  formatAsTime, isValidISODate, dateDifference, addTime,
  isPast, isFuture, isToday, startOfDay, endOfDay,
  formatRelativeTime, TIMEZONES, validateDateRange,
} from '../date-utils';

describe('date-utils', () => {
  describe('toUTCISO', () => {
    it('converts Date object to ISO string', () => {
      const d = new Date('2026-03-15T12:00:00Z');
      expect(toUTCISO(d)).toBe('2026-03-15T12:00:00.000Z');
    });

    it('converts string to ISO string', () => {
      expect(toUTCISO('2026-03-15')).toMatch(/^2026-03-15T/);
    });

    it('converts timestamp to ISO string', () => {
      const ts = new Date('2026-01-01T00:00:00Z').getTime();
      expect(toUTCISO(ts)).toBe('2026-01-01T00:00:00.000Z');
    });

    it('throws on invalid date', () => {
      expect(() => toUTCISO('not-a-date')).toThrow('Invalid date');
    });

    it('throws when date is falsy', () => {
      expect(() => toUTCISO('' as any as string)).toThrow();
    });
  });

  describe('parseDate', () => {
    it('returns Date from ISO string', () => {
      const d = parseDate('2026-03-15T12:00:00Z');
      expect(d).toBeInstanceOf(Date);
      expect(d.toISOString()).toBe('2026-03-15T12:00:00.000Z');
    });

    it('passes through Date objects', () => {
      const original = new Date('2026-01-01');
      expect(parseDate(original)).toBe(original);
    });

    it('throws on invalid input', () => {
      expect(() => parseDate('nope')).toThrow('Invalid date');
    });

    it('throws when date is falsy', () => {
      expect(() => parseDate('' as any as string)).toThrow();
    });
  });

  describe('now', () => {
    it('returns current time as ISO string', () => {
      const result = now();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(result).toMatch(/Z$/);
    });
  });

  describe('formatForDisplay', () => {
    it('formats date in UTC by default', () => {
      const result = formatForDisplay('2026-03-15T15:30:00Z', 'UTC');
      expect(result).toContain('Mar');
      expect(result).toContain('15');
    });

    it('formats with custom options', () => {
      const result = formatForDisplay('2026-03-15T15:30:00Z', 'UTC', { dateStyle: 'full', timeStyle: 'short' });
      expect(result).toContain('2026');
    });
  });

  describe('formatAsDate', () => {
    it('returns YYYY-MM-DD format', () => {
      expect(formatAsDate('2026-03-15T15:30:00Z')).toBe('2026-03-15');
    });

    it('respects timezone', () => {
      // Midnight UTC on March 15 is still March 14 in Pacific time
      const result = formatAsDate('2026-03-15T02:00:00Z', 'America/Los_Angeles');
      expect(result).toBe('2026-03-14');
    });
  });

  describe('formatAsTime', () => {
    it('returns time string', () => {
      const result = formatAsTime('2026-03-15T15:30:45Z', 'UTC');
      expect(result).toContain('15');
      expect(result).toContain('30');
    });
  });

  describe('isValidISODate', () => {
    it('returns true for valid ISO date', () => {
      expect(isValidISODate('2026-03-15T15:30:00Z')).toBe(true);
    });

    it('returns true for date-only string', () => {
      expect(isValidISODate('2026-03-15')).toBe(true);
    });

    it('returns false for invalid string', () => {
      expect(isValidISODate('not a date')).toBe(false);
    });

    it('returns false for non-string input', () => {
      expect(isValidISODate(123 as any as string)).toBe(false);
    });
  });

  describe('dateDifference', () => {
    it('calculates difference between two dates', () => {
      const diff = dateDifference('2026-03-15T00:00:00Z', '2026-03-16T00:00:00Z');
      expect(diff.days).toBe(1);
      expect(diff.hours).toBe(24);
      expect(diff.minutes).toBe(1440);
      expect(diff.seconds).toBe(86400);
      expect(diff.milliseconds).toBe(86400000);
    });

    it('returns absolute difference regardless of order', () => {
      const diff = dateDifference('2026-03-16T00:00:00Z', '2026-03-15T00:00:00Z');
      expect(diff.days).toBe(1);
    });
  });

  describe('addTime', () => {
    const base = '2026-03-15T12:00:00Z';

    it('adds days', () => {
      const result = addTime(base, 2, 'days');
      expect(result.toISOString()).toBe('2026-03-17T12:00:00.000Z');
    });

    it('subtracts hours', () => {
      const result = addTime(base, -3, 'hours');
      expect(result.toISOString()).toBe('2026-03-15T09:00:00.000Z');
    });

    it('adds minutes', () => {
      const result = addTime(base, 30, 'minutes');
      expect(result.toISOString()).toBe('2026-03-15T12:30:00.000Z');
    });

    it('adds seconds', () => {
      const result = addTime(base, 90, 'seconds');
      expect(result.toISOString()).toBe('2026-03-15T12:01:30.000Z');
    });

    it('adds milliseconds', () => {
      const result = addTime(base, 500, 'milliseconds');
      expect(result.toISOString()).toBe('2026-03-15T12:00:00.500Z');
    });

    it('adds weeks', () => {
      const result = addTime(base, 1, 'weeks');
      expect(result.toISOString()).toBe('2026-03-22T12:00:00.000Z');
    });

    it('adds months', () => {
      const result = addTime(base, 1, 'months');
      expect(result.getMonth()).toBe(3); // April (0-indexed)
    });

    it('adds years', () => {
      const result = addTime(base, 1, 'years');
      expect(result.getFullYear()).toBe(2027);
    });
  });

  describe('isPast', () => {
    it('returns true for past dates', () => {
      expect(isPast('2020-01-01T00:00:00Z')).toBe(true);
    });

    it('returns false for future dates', () => {
      expect(isPast('2099-01-01T00:00:00Z')).toBe(false);
    });
  });

  describe('isFuture', () => {
    it('returns true for future dates', () => {
      expect(isFuture('2099-01-01T00:00:00Z')).toBe(true);
    });

    it('returns false for past dates', () => {
      expect(isFuture('2020-01-01T00:00:00Z')).toBe(false);
    });
  });

  describe('isToday', () => {
    it('returns true for today', () => {
      expect(isToday(new Date())).toBe(true);
    });

    it('returns false for yesterday', () => {
      const yesterday = new Date(Date.now() - 86400000);
      expect(isToday(yesterday)).toBe(false);
    });
  });

  describe('startOfDay', () => {
    it('returns start of day as ISO string', () => {
      const result = startOfDay('2026-03-15T15:30:00Z', 'UTC');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(result).toMatch(/Z$/);
    });

    it('handles non-UTC timezone', () => {
      const result = startOfDay('2026-03-15T15:30:00Z', 'America/Toronto');
      expect(result).toBeDefined();
      expect(result).toMatch(/Z$/);
    });
  });

  describe('endOfDay', () => {
    it('returns end of day exactly 24h-1ms after start', () => {
      const start = new Date(startOfDay('2026-03-15T15:30:00Z', 'UTC')).getTime();
      const end = new Date(endOfDay('2026-03-15T15:30:00Z', 'UTC')).getTime();
      expect(end - start).toBe(24 * 60 * 60 * 1000 - 1);
    });
  });

  describe('formatRelativeTime', () => {
    it('formats past dates', () => {
      const base = '2026-03-15T12:00:00Z';
      const past = '2026-03-14T12:00:00Z';
      const result = formatRelativeTime(past, base);
      expect(result).toContain('day');
    });

    it('formats future dates', () => {
      const base = '2026-03-15T12:00:00Z';
      const future = '2026-03-17T12:00:00Z';
      const result = formatRelativeTime(future, base);
      expect(result).toContain('2');
    });

    it('formats hours', () => {
      const base = '2026-03-15T12:00:00Z';
      const past = '2026-03-15T09:00:00Z';
      const result = formatRelativeTime(past, base);
      expect(result).toContain('hour');
    });

    it('formats minutes', () => {
      const base = '2026-03-15T12:00:00Z';
      const past = '2026-03-15T11:30:00Z';
      const result = formatRelativeTime(past, base);
      expect(result).toContain('minute');
    });

    it('formats seconds', () => {
      const base = '2026-03-15T12:00:00Z';
      const past = '2026-03-15T11:59:30Z';
      const result = formatRelativeTime(past, base);
      expect(result).toContain('second');
    });

    it('formats weeks', () => {
      const base = '2026-03-15T12:00:00Z';
      const past = '2026-03-01T12:00:00Z';
      const result = formatRelativeTime(past, base);
      expect(result).toContain('week');
    });

    it('formats months', () => {
      const base = '2026-03-15T12:00:00Z';
      const past = '2026-01-10T12:00:00Z';
      const result = formatRelativeTime(past, base);
      expect(result).toContain('month');
    });

    it('formats years', () => {
      const base = '2026-03-15T12:00:00Z';
      const past = '2024-03-15T12:00:00Z';
      const result = formatRelativeTime(past, base);
      expect(result).toContain('year');
    });

    it('formats future dates (Batch 35)', () => {
      const base = '2026-03-15T12:00:00Z';
      const futureYear = '2028-03-15T12:00:00Z';
      expect(formatRelativeTime(futureYear, base)).toContain('year');

      const futureMonth = '2026-05-20T12:00:00Z';
      expect(formatRelativeTime(futureMonth, base)).toContain('month');

      const futureWeek = '2026-03-25T12:00:00Z';
      expect(formatRelativeTime(futureWeek, base)).toContain('week');

      const futureHour = '2026-03-15T16:00:00Z';
      expect(formatRelativeTime(futureHour, base)).toContain('hour');

      const futureMin = '2026-03-15T12:10:00Z';
      expect(formatRelativeTime(futureMin, base)).toContain('minute');

      const futureSec = '2026-03-15T12:00:10Z';
      expect(formatRelativeTime(futureSec, base)).toContain('second');
    });
  });

  describe('TIMEZONES', () => {
    it('has expected timezone values', () => {
      expect(TIMEZONES.UTC).toBe('UTC');
      expect(TIMEZONES.EASTERN).toBe('America/Toronto');
      expect(TIMEZONES.PACIFIC).toBe('America/Los_Angeles');
    });
  });

  describe('validateDateRange', () => {
    it('accepts valid range', () => {
      expect(() => validateDateRange('2026-03-01', '2026-03-15')).not.toThrow();
    });

    it('throws when end is before start', () => {
      expect(() => validateDateRange('2026-03-15', '2026-03-01')).toThrow('End date must be after start date');
    });
  });
});
