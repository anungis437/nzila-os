import { describe, it, expect } from 'vitest';
import { toUTCISO, parseDate, now, formatForDisplay, formatAsDate } from '../date-utils';

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
      expect(() => toUTCISO('' as any)).toThrow();
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
  });

  describe('formatAsDate', () => {
    it('returns YYYY-MM-DD format', () => {
      expect(formatAsDate('2026-03-15T15:30:00Z')).toBe('2026-03-15');
    });
  });
});
