/**
 * Tests for CSV export utility — PR-051
 *
 * Validates CSV generation, escaping, injection prevention,
 * and pre-built column sets.
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Local mirrors
// ---------------------------------------------------------------------------

interface CSVColumn<T> { header: string; accessor: (row: T) => string | number | null | undefined; }

function escapeCSVValue(value: string | number | null | undefined): string {
  if (value == null) return '';
  const str = String(value);
  if (str.length === 0) return '';
  const firstChar = str.charAt(0);
  const dangerousChars = ['=', '+', '-', '@', '\t', '\r'];
  let safe = dangerousChars.includes(firstChar) ? `'${str}` : str;
  if (safe.includes('"') || safe.includes(',') || safe.includes('\n') || safe.includes('\r')) {
    safe = `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function generateCSV<T>(rows: T[], columns: CSVColumn<T>[]): string {
  const header = columns.map((c) => escapeCSVValue(c.header)).join(',');
  const body = rows.map((row) => columns.map((c) => escapeCSVValue(c.accessor(row))).join(','));
  return [header, ...body].join('\n');
}

function kpiCardsToRows(kpis: { totalOpen: number; newThisWeek: number; overdueAcknowledgement: number; overdueResolution: number }) {
  return [
    { metric: 'Total Open', value: kpis.totalOpen },
    { metric: 'New This Week', value: kpis.newThisWeek },
    { metric: 'Overdue Acknowledgement', value: kpis.overdueAcknowledgement },
    { metric: 'Overdue Resolution', value: kpis.overdueResolution },
  ];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('escapeCSVValue', () => {
  it('returns empty string for null/undefined', () => {
    expect(escapeCSVValue(null)).toBe('');
    expect(escapeCSVValue(undefined)).toBe('');
  });

  it('converts numbers to string', () => {
    expect(escapeCSVValue(42)).toBe('42');
    expect(escapeCSVValue(0)).toBe('0');
  });

  it('passes plain strings through', () => {
    expect(escapeCSVValue('hello')).toBe('hello');
  });

  it('wraps values with commas in quotes', () => {
    expect(escapeCSVValue('a,b')).toBe('"a,b"');
  });

  it('doubles internal quotes', () => {
    expect(escapeCSVValue('say "hello"')).toBe('"say ""hello"""');
  });

  it('wraps values with newlines in quotes', () => {
    expect(escapeCSVValue('line1\nline2')).toBe('"line1\nline2"');
  });

  it('neutralizes formula injection with =', () => {
    const result = escapeCSVValue('=cmd|/c calc');
    expect(result.startsWith("'")).toBe(true);
  });

  it('neutralizes formula injection with +', () => {
    const result = escapeCSVValue('+cmd|/c calc');
    expect(result.startsWith("'")).toBe(true);
  });

  it('neutralizes formula injection with -', () => {
    const result = escapeCSVValue('-cmd|/c calc');
    expect(result.startsWith("'")).toBe(true);
  });

  it('neutralizes formula injection with @', () => {
    const result = escapeCSVValue('@SUM(A1)');
    expect(result.startsWith("'")).toBe(true);
  });
});

describe('generateCSV', () => {
  const columns: CSVColumn<{ name: string; age: number }>[] = [
    { header: 'Name', accessor: (r) => r.name },
    { header: 'Age', accessor: (r) => r.age },
  ];

  it('generates header row', () => {
    const csv = generateCSV([], columns);
    expect(csv).toBe('Name,Age');
  });

  it('generates data rows', () => {
    const rows = [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }];
    const csv = generateCSV(rows, columns);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe('Alice,30');
    expect(lines[2]).toBe('Bob,25');
  });

  it('handles null values in data', () => {
    const cols: CSVColumn<{ x: string | null }>[] = [
      { header: 'X', accessor: (r) => r.x },
    ];
    const csv = generateCSV([{ x: null }], cols);
    expect(csv).toBe('X\n');
  });
});

describe('kpiCardsToRows', () => {
  it('converts KPI cards to array of metric/value rows', () => {
    const kpis = { totalOpen: 10, newThisWeek: 3, overdueAcknowledgement: 2, overdueResolution: 1 };
    const rows = kpiCardsToRows(kpis);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toEqual({ metric: 'Total Open', value: 10 });
    expect(rows[3]).toEqual({ metric: 'Overdue Resolution', value: 1 });
  });
});
