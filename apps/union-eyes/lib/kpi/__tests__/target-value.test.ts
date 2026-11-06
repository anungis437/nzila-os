import { describe, expect, it } from 'vitest'
import { evaluateTargetValue, sourceMismatchReason } from '../target-value'

// DEF-0B12-PLT-KPI-CURRENT-VALUE-IS-THE-LATEST-ROW-OF-THE-METRIC-TYPE-TEXT-NOT-THE-DECLARED-SOURCE-OR-CALCULATION:
// the value was the latest row whose metric type text matched. It is now the declared aggregation over the recent periods of a metric
// type that is computed from the declared source, and otherwise not measured with the reason.

const row = (periodEnd: string, metricValue: string, extra: Record<string, unknown> = {}) => ({
  metricValue,
  periodType: 'monthly',
  periodStart: new Date(new Date(periodEnd).getTime() - 30 * 86_400_000),
  periodEnd: new Date(periodEnd),
  createdAt: new Date(periodEnd),
  trend: 'up',
  ...extra,
})

describe('evaluateTargetValue', () => {
  it('does not attribute a metric to a data source it is not computed from', () => {
    const value = evaluateTargetValue({
      metricType: 'claims_volume', dataSource: 'financial', calculation: { aggregation: 'sum' }, windowRows: [row('2026-10-31', '40')],
    })
    expect(value.currentValue).toBeNull()
    expect(value.valueBasis).toBe('not_measured')
    expect(value.notMeasuredReason).toMatch(/computed from claims, not from the declared data source "financial"/)
  })

  it('does not take a free-text metric type no computation produces', () => {
    expect(sourceMismatchReason('my_custom_metric', 'custom_query')).toMatch(/no computation in Union Eyes produces/)
  })

  it('applies the declared aggregation over distinct periods instead of reading the latest row', () => {
    const rows = [row('2026-10-31', '40'), row('2026-09-30', '20'), row('2026-08-31', '30')]
    const of = (aggregation: string) =>
      evaluateTargetValue({ metricType: 'claims_volume', dataSource: 'claims', calculation: { aggregation }, windowRows: rows })
    expect(of('sum').currentValue).toBe(90)
    expect(of('avg').currentValue).toBe(30)
    expect(of('min').currentValue).toBe(20)
    expect(of('max').currentValue).toBe(40)
    expect(of('count').currentValue).toBe(3)
    expect(of('sum')).toMatchObject({ valueBasis: 'declared_aggregation_of_metric_periods', periodsUsed: 3, asOf: '2026-10-31T00:00:00.000Z', trend: null })
  })

  it('counts a recomputed period once (its latest row) and mixes no other period type into it', () => {
    const rows = [
      row('2026-10-31', '50', { createdAt: new Date('2026-11-02') }),
      row('2026-10-31', '40', { createdAt: new Date('2026-11-01') }),
      row('2026-10-30', '7', { periodType: 'daily' }),
    ]
    const value = evaluateTargetValue({ metricType: 'claims_volume', dataSource: 'claims', calculation: { aggregation: 'sum' }, windowRows: rows })
    expect(value.currentValue).toBe(50)
    expect(value.periodsUsed).toBe(1)
    expect(value.trend).toBe('up')
  })

  it('is not measured without a supported aggregation or without a recent period', () => {
    expect(evaluateTargetValue({ metricType: 'member_growth', dataSource: 'members', calculation: { formula: 'x' }, windowRows: [row('2026-10-31', '3')] }).notMeasuredReason)
      .toMatch(/no supported aggregation/)
    expect(evaluateTargetValue({ metricType: 'member_growth', dataSource: 'members', calculation: { aggregation: 'sum' }, windowRows: [] }).currentValue)
      .toBeNull()
  })
})
