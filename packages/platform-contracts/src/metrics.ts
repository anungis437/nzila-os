/**
 * Metrics Contract — canonical interface for platform metrics reporting.
 *
 * Apps emit structured metrics that the control plane aggregates.
 */

export type MetricType = 'counter' | 'gauge' | 'histogram'

export interface MetricEntry {
  name: string
  type: MetricType
  value: number
  labels: Record<string, string>
  timestamp: string
}

export interface MetricsSummary {
  app: string
  org_id: string
  period_start: string
  period_end: string
  entries: MetricEntry[]
}

export interface MetricsContract {
  collect(orgId: string): Promise<MetricsSummary>
}
