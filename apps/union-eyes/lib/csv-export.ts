/**
 * CSV Export — Dashboard & Case Data Export
 *
 * PR-051: Utility for converting dashboard metrics and case data
 * into CSV format for download.
 *
 * Security: Values are escaped to prevent CSV injection.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CSVColumn<T> {
  header: string;
  accessor: (row: T) => string | number | null | undefined;
}

// ---------------------------------------------------------------------------
// CSV Generation
// ---------------------------------------------------------------------------

/**
 * Escape a value for safe CSV output.
 * - Wraps in quotes if it contains comma, quote, or newline.
 * - Doubles internal quotes.
 * - Neutralises formula injection (=, +, -, @, \t, \r) with a leading apostrophe.
 */
export function escapeCSVValue(value: string | number | null | undefined): string {
  if (value == null) return '';
  const str = String(value);
  if (str.length === 0) return '';

  // CSV injection prevention: neutralize formulas
  const firstChar = str.charAt(0);
  const dangerousChars = ['=', '+', '-', '@', '\t', '\r'];
  let safe = dangerousChars.includes(firstChar) ? `'${str}` : str;

  // Escape quotes and wrap if needed
  if (safe.includes('"') || safe.includes(',') || safe.includes('\n') || safe.includes('\r')) {
    safe = `"${safe.replace(/"/g, '""')}"`;
  }

  return safe;
}

/**
 * Generate a CSV string from an array of objects and column definitions.
 */
export function generateCSV<T>(rows: T[], columns: CSVColumn<T>[]): string {
  const header = columns.map((c) => escapeCSVValue(c.header)).join(',');
  const body = rows.map((row) =>
    columns.map((c) => escapeCSVValue(c.accessor(row))).join(','),
  );
  return [header, ...body].join('\n');
}

// ---------------------------------------------------------------------------
// Pre-built column sets for CUPE dashboard
// ---------------------------------------------------------------------------

import type { CaseRow, KPICards, AgingBucket, CategoryCount, WorksiteCount, AssigneeCount, ClosureTrendPoint } from './dashboard-metrics';

export const CASE_COLUMNS: CSVColumn<CaseRow>[] = [
  { header: 'Case ID', accessor: (r) => r.id },
  { header: 'Status', accessor: (r) => r.status },
  { header: 'Priority', accessor: (r) => r.priority },
  { header: 'Type', accessor: (r) => r.type },
  { header: 'Assignee', accessor: (r) => r.assignee },
  { header: 'Worksite', accessor: (r) => r.worksite },
  { header: 'Created', accessor: (r) => r.createdAt.toISOString() },
  { header: 'Resolved', accessor: (r) => r.resolvedAt?.toISOString() },
];

export const KPI_COLUMNS: CSVColumn<{ metric: string; value: number }>[] = [
  { header: 'Metric', accessor: (r) => r.metric },
  { header: 'Value', accessor: (r) => r.value },
];

export const AGING_COLUMNS: CSVColumn<AgingBucket>[] = [
  { header: 'Age Range', accessor: (r) => r.label },
  { header: 'Count', accessor: (r) => r.count },
];

export const CATEGORY_COLUMNS: CSVColumn<CategoryCount>[] = [
  { header: 'Case Type', accessor: (r) => r.type },
  { header: 'Count', accessor: (r) => r.count },
];

export const WORKSITE_COLUMNS: CSVColumn<WorksiteCount>[] = [
  { header: 'Worksite', accessor: (r) => r.worksite },
  { header: 'Open Cases', accessor: (r) => r.count },
];

export const ASSIGNEE_COLUMNS: CSVColumn<AssigneeCount>[] = [
  { header: 'Assignee', accessor: (r) => r.assignee },
  { header: 'Open Cases', accessor: (r) => r.count },
];

export const TREND_COLUMNS: CSVColumn<ClosureTrendPoint>[] = [
  { header: 'Week Starting', accessor: (r) => r.week },
  { header: 'Cases Closed', accessor: (r) => r.closedCount },
];

/**
 * Convert KPICards to rows suitable for CSV export.
 */
export function kpiCardsToRows(kpis: KPICards): { metric: string; value: number }[] {
  return [
    { metric: 'Total Open', value: kpis.totalOpen },
    { metric: 'New This Week', value: kpis.newThisWeek },
    { metric: 'Overdue Acknowledgement', value: kpis.overdueAcknowledgement },
    { metric: 'Overdue Resolution', value: kpis.overdueResolution },
  ];
}
