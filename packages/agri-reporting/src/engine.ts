// ---------------------------------------------------------------------------
// @nzila/agri-reporting — Report generation engine
// ---------------------------------------------------------------------------

import type { AgriReport, ReportMetric } from '@nzila/agri-core'

// ─── Report types ─────────────────────────────────────────────────────────

export const ReportType = {
  FARM_SUMMARY: 'farm_summary',
  COOPERATIVE_SUMMARY: 'cooperative_summary',
  SEASONAL_PRODUCTION: 'seasonal_production',
  SUPPLY_CHAIN_PERFORMANCE: 'supply_chain_performance',
  RISK_ASSESSMENT: 'risk_assessment',
  FORECAST_ACCURACY: 'forecast_accuracy',
  ENVIRONMENTAL: 'environmental',
} as const

export type ReportTypeValue = (typeof ReportType)[keyof typeof ReportType]

// ─── Metric helper ────────────────────────────────────────────────────────

export function metric(
  key: string,
  label: string,
  value: number,
  unit: string,
  period: string,
): ReportMetric {
  return { key, label, value, unit, period }
}

// ─── Report builder ───────────────────────────────────────────────────────

let reportSeq = 0

export interface BuildReportParams {
  orgId: string
  reportType: ReportTypeValue
  title: string
  period: { start: string; end: string }
  metrics: ReportMetric[]
  metadata?: Record<string, unknown>
}

export function buildReport(params: BuildReportParams): AgriReport {
  reportSeq++
  return {
    id: `rpt_${Date.now().toString(36)}_${reportSeq.toString(36)}`,
    orgId: params.orgId,
    reportType: params.reportType,
    title: params.title,
    generatedAt: new Date().toISOString(),
    period: params.period,
    metrics: params.metrics,
    metadata: params.metadata ?? {},
  }
}

// ─── Aggregation utilities ────────────────────────────────────────────────

export function aggregateMetrics(
  metrics: readonly ReportMetric[],
  key: string,
): { sum: number; avg: number; count: number } {
  const matching = metrics.filter((m) => m.key === key)
  if (matching.length === 0) return { sum: 0, avg: 0, count: 0 }
  const sum = matching.reduce((acc, m) => acc + m.value, 0)
  return { sum, avg: sum / matching.length, count: matching.length }
}

export function mergeReportMetrics(
  ...reports: readonly AgriReport[]
): ReportMetric[] {
  return reports.flatMap((r) => r.metrics)
}

// ─── Composite report builder ─────────────────────────────────────────────

export function buildCompositeReport(
  orgId: string,
  title: string,
  period: { start: string; end: string },
  sourceReports: readonly AgriReport[],
  metadata?: Record<string, unknown>,
): AgriReport {
  const allMetrics = mergeReportMetrics(...sourceReports)
  return buildReport({
    orgId,
    reportType: 'composite' as ReportTypeValue,
    title,
    period,
    metrics: allMetrics,
    metadata: {
      ...metadata,
      sourceReportIds: sourceReports.map((r) => r.id),
    },
  })
}
