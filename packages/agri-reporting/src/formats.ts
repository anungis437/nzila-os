// ---------------------------------------------------------------------------
// @nzila/agri-reporting — CoraGov-ready output formats
// ---------------------------------------------------------------------------

import type { AgriReport, ReportMetric } from '@nzila/agri-core'

// ─── CoraGov-ready table format ───────────────────────────────────────────

export interface GovReportRow {
  readonly metricKey: string
  readonly metricLabel: string
  readonly value: number
  readonly unit: string
  readonly period: string
}

export interface GovReport {
  readonly reportId: string
  readonly orgId: string
  readonly reportType: string
  readonly title: string
  readonly generatedAt: string
  readonly periodStart: string
  readonly periodEnd: string
  readonly rows: readonly GovReportRow[]
}

export function toGovReport(report: AgriReport): GovReport {
  return {
    reportId: report.id,
    orgId: report.orgId,
    reportType: report.reportType,
    title: report.title,
    generatedAt: report.generatedAt,
    periodStart: report.period.start,
    periodEnd: report.period.end,
    rows: report.metrics.map(metricToGovRow),
  }
}

function metricToGovRow(m: ReportMetric): GovReportRow {
  return {
    metricKey: m.key,
    metricLabel: m.label,
    value: m.value,
    unit: m.unit,
    period: m.period,
  }
}

// ─── CSV serialisation ────────────────────────────────────────────────────

const CSV_HEADERS = 'metric_key,metric_label,value,unit,period'

function escapeCSV(val: string | number): string {
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function toCSV(report: AgriReport): string {
  const lines = [CSV_HEADERS]
  for (const m of report.metrics) {
    lines.push(
      [m.key, m.label, m.value, m.unit, m.period].map(escapeCSV).join(','),
    )
  }
  return lines.join('\n')
}

// ─── JSON summary (for API responses) ─────────────────────────────────────

export interface ReportSummary {
  readonly id: string
  readonly reportType: string
  readonly title: string
  readonly generatedAt: string
  readonly metricCount: number
}

export function toSummary(report: AgriReport): ReportSummary {
  return {
    id: report.id,
    reportType: report.reportType,
    title: report.title,
    generatedAt: report.generatedAt,
    metricCount: report.metrics.length,
  }
}
