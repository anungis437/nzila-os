import { describe, it, expect } from 'vitest';
import { escapeCSVValue, generateCSV, kpiCardsToRows } from '../csv-export';

describe('csv-export', () => {
  describe('escapeCSVValue', () => {
    it('returns empty string for null/undefined', () => {
      expect(escapeCSVValue(null)).toBe('');
      expect(escapeCSVValue(undefined)).toBe('');
    });

    it('returns number as string', () => {
      expect(escapeCSVValue(42)).toBe('42');
    });

    it('wraps values containing commas in quotes', () => {
      expect(escapeCSVValue('hello, world')).toBe('"hello, world"');
    });

    it('doubles internal quotes', () => {
      expect(escapeCSVValue('say "hi"')).toBe('"say ""hi"""');
    });

    it('neutralises formula injection with leading apostrophe', () => {
      expect(escapeCSVValue('=SUM(A1)')).toMatch(/^'/);
      expect(escapeCSVValue('+cmd')).toMatch(/^'/);
      expect(escapeCSVValue('-exec')).toMatch(/^'/);
      expect(escapeCSVValue('@import')).toMatch(/^'/);
    });

    it('returns plain strings as-is', () => {
      expect(escapeCSVValue('hello')).toBe('hello');
    });
  });

  describe('generateCSV', () => {
    it('generates header + data rows', () => {
      const rows = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ];
      const columns = [
        { header: 'Name', accessor: (r: typeof rows[0]) => r.name },
        { header: 'Age', accessor: (r: typeof rows[0]) => r.age },
      ];
      const csv = generateCSV(rows, columns);
      const lines = csv.split('\n');
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('Name,Age');
      expect(lines[1]).toBe('Alice,30');
    });
  });

  describe('kpiCardsToRows', () => {
    it('maps KPICards to metric/value rows', () => {
      const kpis = {
        totalOpen: 10,
        newThisWeek: 3,
        overdueAcknowledgement: 1,
        overdueResolution: 2,
      };
      const rows = kpiCardsToRows(kpis as any);
      expect(rows).toHaveLength(4);
      expect(rows[0]).toEqual({ metric: 'Total Open', value: 10 });
    });
  });
});
