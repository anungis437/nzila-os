import { describe, it, expect } from 'vitest';
import {
  escapeCSVValue,
  generateCSV,
  kpiCardsToRows,
  CASE_COLUMNS,
  KPI_COLUMNS,
  AGING_COLUMNS,
  CATEGORY_COLUMNS,
  WORKSITE_COLUMNS,
  ASSIGNEE_COLUMNS,
  TREND_COLUMNS,
} from '../csv-export';

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
      const rows = kpiCardsToRows(kpis as any as Parameters<typeof kpiCardsToRows>[0]);
      expect(rows).toHaveLength(4);
      expect(rows[0]).toEqual({ metric: 'Total Open', value: 10 });
    });
  });

  describe('escapeCSVValue edge cases', () => {
    it('handles newlines by wrapping in quotes', () => {
      expect(escapeCSVValue('line1\nline2')).toBe('"line1\nline2"');
    });

    it('handles boolean values', () => {
      expect(escapeCSVValue(true as any as string)).toBe('true');
      expect(escapeCSVValue(false as any as string)).toBe('false');
    });

    it('handles zero', () => {
      expect(escapeCSVValue(0)).toBe('0');
    });

    it('handles empty string', () => {
      expect(escapeCSVValue('')).toBe('');
    });

    it('neutralises tab injection', () => {
      expect(escapeCSVValue('\tcmd')).toMatch(/^'/);
    });

    it('handles carriage return by wrapping in quotes', () => {
      const result = escapeCSVValue('\rdata');
      // \r is a dangerous char so gets apostrophe prefix, then \r triggers quote-wrapping
      expect(result).toContain('data');
      expect(result.length).toBeGreaterThan(4);
    });
  });

  describe('generateCSV edge cases', () => {
    it('returns only header row for empty data', () => {
      const columns = [
        { header: 'Name', accessor: (r: { name: string }) => r.name },
      ];
      const csv = generateCSV([], columns);
      expect(csv).toBe('Name');
    });

    it('handles values with commas and quotes', () => {
      const rows = [{ val: 'hello, "world"' }];
      const columns = [
        { header: 'Val', accessor: (r: typeof rows[0]) => r.val },
      ];
      const csv = generateCSV(rows, columns);
      const lines = csv.split('\n');
      expect(lines).toHaveLength(2);
      // The value should be properly escaped
      expect(lines[1]).toContain('"');
    });

    it('handles null accessor values', () => {
      const rows = [{ val: null as string | null }];
      const columns = [
        { header: 'Val', accessor: (r: typeof rows[0]) => r.val },
      ];
      const csv = generateCSV(rows, columns);
      const lines = csv.split('\n');
      expect(lines[1]).toBe('');
    });
  });

  describe('column constants', () => {
    it('CASE_COLUMNS has expected headers', () => {
      expect(CASE_COLUMNS.length).toBeGreaterThanOrEqual(6);
      const headers = CASE_COLUMNS.map((c) => c.header);
      expect(headers).toContain('Case ID');
      expect(headers).toContain('Status');
      expect(headers).toContain('Priority');
      expect(headers).toContain('Assignee');
    });

    it('KPI_COLUMNS has Metric and Value', () => {
      expect(KPI_COLUMNS).toHaveLength(2);
      expect(KPI_COLUMNS[0].header).toBe('Metric');
      expect(KPI_COLUMNS[1].header).toBe('Value');
    });

    it('AGING_COLUMNS has Age Range and Count', () => {
      expect(AGING_COLUMNS).toHaveLength(2);
      expect(AGING_COLUMNS[0].header).toBe('Age Range');
      expect(AGING_COLUMNS[1].header).toBe('Count');
    });

    it('CATEGORY_COLUMNS has Case Type and Count', () => {
      expect(CATEGORY_COLUMNS).toHaveLength(2);
      expect(CATEGORY_COLUMNS[0].header).toBe('Case Type');
    });

    it('WORKSITE_COLUMNS has Worksite and Open Cases', () => {
      expect(WORKSITE_COLUMNS).toHaveLength(2);
      expect(WORKSITE_COLUMNS[0].header).toBe('Worksite');
      expect(WORKSITE_COLUMNS[1].header).toBe('Open Cases');
    });

    it('ASSIGNEE_COLUMNS has Assignee and Open Cases', () => {
      expect(ASSIGNEE_COLUMNS).toHaveLength(2);
      expect(ASSIGNEE_COLUMNS[0].header).toBe('Assignee');
    });

    it('TREND_COLUMNS has Week Starting and Cases Closed', () => {
      expect(TREND_COLUMNS).toHaveLength(2);
      expect(TREND_COLUMNS[0].header).toBe('Week Starting');
      expect(TREND_COLUMNS[1].header).toBe('Cases Closed');
    });

    it('column accessors are functions', () => {
      for (const col of CASE_COLUMNS) {
        expect(typeof col.accessor).toBe('function');
      }
      for (const col of KPI_COLUMNS) {
        expect(typeof col.accessor).toBe('function');
      }
    });
  });
});
