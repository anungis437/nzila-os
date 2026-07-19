import { describe, it, expect } from 'vitest'
import {
  ReportType,
  metric,
  buildReport,
  aggregateMetrics,
  mergeReportMetrics,
  buildCompositeReport,
} from '../src/engine'
import {
  toGovReport,
  toCSV,
  toSummary,
} from '../src/formats'

// ── engine.ts ───────────────────────────────────────────────────────────────

describe('metric', () => {
  it('creates a report metric', () => {
    const m = metric('yield', 'Yield', 1200, 'kg', '2025A')
    expect(m.key).toBe('yield')
    expect(m.value).toBe(1200)
    expect(m.unit).toBe('kg')
  })
})

describe('buildReport', () => {
  it('builds a valid report', () => {
    const report = buildReport({
      orgId: 'org_1',
      reportType: ReportType.FARM_SUMMARY,
      title: 'Farm Performance Q1',
      period: { start: '2025-01-01', end: '2025-03-31' },
      metrics: [
        metric('yield', 'Total Yield', 5000, 'kg', 'Q1'),
        metric('revenue', 'Revenue', 25000, 'USD', 'Q1'),
      ],
    })
    expect(report.id).toMatch(/^rpt_/)
    expect(report.orgId).toBe('org_1')
    expect(report.reportType).toBe('farm_summary')
    expect(report.metrics).toHaveLength(2)
    expect(report.generatedAt).toBeTruthy()
    expect(report.metadata).toEqual({})
  })

  it('includes custom metadata', () => {
    const report = buildReport({
      orgId: 'org_1',
      reportType: ReportType.COOPERATIVE_SUMMARY,
      title: 'Coop Report',
      period: { start: '2025-01-01', end: '2025-12-31' },
      metrics: [],
      metadata: { region: 'central' },
    })
    expect(report.metadata).toEqual({ region: 'central' })
  })
})

describe('aggregateMetrics', () => {
  it('calculates sum, avg, count for matching key', () => {
    const metrics = [
      metric('yield', 'Yield', 100, 'kg', 'Q1'),
      metric('yield', 'Yield', 200, 'kg', 'Q2'),
      metric('revenue', 'Revenue', 500, 'USD', 'Q1'),
    ]
    const agg = aggregateMetrics(metrics, 'yield')
    expect(agg.sum).toBe(300)
    expect(agg.avg).toBe(150)
    expect(agg.count).toBe(2)
  })

  it('returns zeros for no matches', () => {
    const agg = aggregateMetrics([], 'missing')
    expect(agg).toEqual({ sum: 0, avg: 0, count: 0 })
  })
})

describe('mergeReportMetrics', () => {
  it('merges metrics from multiple reports', () => {
    const r1 = buildReport({
      orgId: 'o1',
      reportType: ReportType.FARM_SUMMARY,
      title: 'R1',
      period: { start: 'a', end: 'b' },
      metrics: [metric('a', 'A', 1, 'x', 'p')],
    })
    const r2 = buildReport({
      orgId: 'o1',
      reportType: ReportType.FARM_SUMMARY,
      title: 'R2',
      period: { start: 'a', end: 'b' },
      metrics: [metric('b', 'B', 2, 'x', 'p')],
    })
    const merged = mergeReportMetrics(r1, r2)
    expect(merged).toHaveLength(2)
  })
})

describe('buildCompositeReport', () => {
  it('combines multiple reports', () => {
    const r1 = buildReport({
      orgId: 'o1',
      reportType: ReportType.FARM_SUMMARY,
      title: 'R1',
      period: { start: '2025-01-01', end: '2025-06-30' },
      metrics: [metric('yield', 'Yield', 100, 'kg', 'H1')],
    })
    const composite = buildCompositeReport(
      'o1',
      'Annual Summary',
      { start: '2025-01-01', end: '2025-12-31' },
      [r1],
    )
    expect(composite.title).toBe('Annual Summary')
    expect(composite.metrics).toHaveLength(1)
    expect((composite.metadata as unknown).sourceReportIds).toContain(r1.id)
  })
})

// ── formats.ts ──────────────────────────────────────────────────────────────

describe('toGovReport', () => {
  it('converts to CoraGov format', () => {
    const report = buildReport({
      orgId: 'o1',
      reportType: ReportType.COOPERATIVE_SUMMARY,
      title: 'Gov Report',
      period: { start: '2025-01-01', end: '2025-12-31' },
      metrics: [metric('farmers', 'Active Farmers', 42, 'count', 'FY25')],
    })
    const gov = toGovReport(report)
    expect(gov.reportId).toBe(report.id)
    expect(gov.periodStart).toBe('2025-01-01')
    expect(gov.periodEnd).toBe('2025-12-31')
    expect(gov.rows).toHaveLength(1)
    expect(gov.rows[0]!.metricKey).toBe('farmers')
  })
})

describe('toCSV', () => {
  it('generates valid CSV', () => {
    const report = buildReport({
      orgId: 'o1',
      reportType: ReportType.FARM_SUMMARY,
      title: 'CSV Test',
      period: { start: '2025-01-01', end: '2025-03-31' },
      metrics: [
        metric('yield', 'Total Yield', 1200, 'kg', 'Q1'),
        metric('revenue', 'Revenue', 5000, 'USD', 'Q1'),
      ],
    })
    const csv = toCSV(report)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('metric_key,metric_label,value,unit,period')
    expect(lines).toHaveLength(3) // header + 2 rows
    expect(lines[1]).toContain('yield')
    expect(lines[1]).toContain('1200')
  })

  it('escapes commas in values', () => {
    const report = buildReport({
      orgId: 'o1',
      reportType: ReportType.FARM_SUMMARY,
      title: 'Test',
      period: { start: 'a', end: 'b' },
      metrics: [metric('key', 'Label, with comma', 100, 'kg', 'Q1')],
    })
    const csv = toCSV(report)
    expect(csv).toContain('"Label, with comma"')
  })
})

describe('toSummary', () => {
  it('creates a report summary', () => {
    const report = buildReport({
      orgId: 'o1',
      reportType: ReportType.RISK_ASSESSMENT,
      title: 'Risk',
      period: { start: 'a', end: 'b' },
      metrics: [metric('r', 'Risk Score', 7.5, 'score', 'Q1')],
    })
    const summary = toSummary(report)
    expect(summary.id).toBe(report.id)
    expect(summary.metricCount).toBe(1)
    expect(summary.reportType).toBe('risk_assessment')
  })
})
