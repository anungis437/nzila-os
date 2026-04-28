import { describe, expect, it } from 'vitest'
import { checkThresholds, detectAnomalies, detectTrends, runInsightEngine } from './insight-engine'

describe('cfo-intelligence insight engine', () => {
  it('detects anomalies when points deviate strongly from mean', () => {
    const insights = detectAnomalies({
      label: 'opex',
      points: [
        { period: '2026-01', value: 100 },
        { period: '2026-02', value: 102 },
        { period: '2026-03', value: 99 },
        { period: '2026-04', value: 250 },
      ],
    }, { zScoreThreshold: 1.5, minDataPoints: 4 })

    expect(insights.length).toBeGreaterThan(0)
    expect(insights[0].category).toBe('anomaly')
    expect(insights[0].metric).toBe('opex')
  })

  it('detects sustained downward trends', () => {
    const insights = detectTrends({
      label: 'cash_reserve',
      points: [
        { period: '2026-01', value: 1000 },
        { period: '2026-02', value: 900 },
        { period: '2026-03', value: 800 },
        { period: '2026-04', value: 700 },
      ],
    })

    expect(insights.some((i) => i.id === 'trend-down-cash_reserve')).toBe(true)
  })

  it('checks threshold breaches against latest value', () => {
    const insights = checkThresholds(
      [
        {
          label: 'burn_rate',
          points: [
            { period: '2026-01', value: 40_000 },
            { period: '2026-02', value: 55_000 },
          ],
        },
      ],
      [
        {
          metric: 'burn_rate',
          operator: 'gt',
          value: 50_000,
          severity: 'critical',
          title: 'Burn rate exceeded threshold',
          suggestedAction: 'Freeze non-critical spend',
        },
      ],
    )

    expect(insights).toHaveLength(1)
    expect(insights[0].severity).toBe('critical')
    expect(insights[0].currentValue).toBe(55_000)
  })

  it('runs full engine and sorts by severity', () => {
    const result = runInsightEngine({
      orgId: 'org-1',
      series: [
        {
          label: 'burn_rate',
          points: [
            { period: '2026-01', value: 45_000 },
            { period: '2026-02', value: 47_000 },
            { period: '2026-03', value: 49_000 },
            { period: '2026-04', value: 70_000 },
          ],
        },
      ],
      anomalyConfig: { zScoreThreshold: 1.4, minDataPoints: 4 },
      thresholdRules: [
        {
          metric: 'burn_rate',
          operator: 'gt',
          value: 50_000,
          severity: 'critical',
          title: 'Burn rate threshold breached',
          suggestedAction: 'Implement emergency spend controls',
        },
      ],
    })

    expect(result.seriesCount).toBe(1)
    expect(result.totalDataPoints).toBe(4)
    expect(result.insights.length).toBeGreaterThan(0)
    expect(result.insights[0].severity).toBe('critical')
  })
})
