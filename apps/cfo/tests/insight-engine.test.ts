/**
 * CFO — Insight Engine Tests
 */
import { describe, it, expect } from 'vitest'
import {
  detectAnomalies,
  detectTrends,
  checkThresholds,
  runInsightEngine,
  type DataSeries,
  type ThresholdRule,
} from '@nzila/cfo-intelligence/insight-engine'

describe('Insight Engine', () => {
  describe('detectAnomalies', () => {
    it('detects an outlier in a stable series', () => {
      const series: DataSeries = {
        label: 'revenue',
        points: [
          { period: '2025-01', value: 100 },
          { period: '2025-02', value: 102 },
          { period: '2025-03', value: 101 },
          { period: '2025-04', value: 99 },
          { period: '2025-05', value: 100 },
          { period: '2025-06', value: 300 }, // outlier
        ],
      }
      const insights = detectAnomalies(series)
      expect(insights.length).toBeGreaterThan(0)
      expect(insights[0].category).toBe('anomaly')
    })

    it('returns no anomalies for uniform data', () => {
      const series: DataSeries = {
        label: 'cost',
        points: [
          { period: '2025-01', value: 50 },
          { period: '2025-02', value: 51 },
          { period: '2025-03', value: 50 },
          { period: '2025-04', value: 49 },
          { period: '2025-05', value: 50 },
        ],
      }
      const insights = detectAnomalies(series)
      expect(insights.length).toBe(0)
    })

    it('respects custom threshold', () => {
      const series: DataSeries = {
        label: 'revenue',
        points: [
          { period: '2025-01', value: 100 },
          { period: '2025-02', value: 100 },
          { period: '2025-03', value: 100 },
          { period: '2025-04', value: 100 },
          { period: '2025-05', value: 130 }, // moderate deviation
        ],
      }
      // low threshold -> should flag
      const low = detectAnomalies(series, { zScoreThreshold: 1 })
      expect(low.length).toBeGreaterThan(0)
      // high threshold -> should not flag
      const high = detectAnomalies(series, { zScoreThreshold: 5 })
      expect(high.length).toBe(0)
    })

    it('skips series with too few data points', () => {
      const series: DataSeries = {
        label: 'revenue',
        points: [
          { period: '2025-01', value: 100 },
          { period: '2025-02', value: 500 },
        ],
      }
      const insights = detectAnomalies(series)
      expect(insights.length).toBe(0)
    })
  })

  describe('detectTrends', () => {
    it('detects an upward trend', () => {
      const series: DataSeries = {
        label: 'revenue',
        points: [
          { period: '2025-01', value: 100 },
          { period: '2025-02', value: 110 },
          { period: '2025-03', value: 120 },
          { period: '2025-04', value: 130 },
        ],
      }
      const insights = detectTrends(series)
      expect(insights.length).toBe(1)
      expect(insights[0].category).toBe('trend')
      expect(insights[0].title).toMatch(/upward/i)
    })

    it('detects a downward trend', () => {
      const series: DataSeries = {
        label: 'cost',
        points: [
          { period: '2025-01', value: 200 },
          { period: '2025-02', value: 190 },
          { period: '2025-03', value: 180 },
          { period: '2025-04', value: 170 },
        ],
      }
      const insights = detectTrends(series)
      expect(insights.length).toBe(1)
    })

    it('detects no trend in oscillating data', () => {
      const series: DataSeries = {
        label: 'cost',
        points: [
          { period: '2025-01', value: 100 },
          { period: '2025-02', value: 200 },
          { period: '2025-03', value: 100 },
          { period: '2025-04', value: 200 },
        ],
      }
      const insights = detectTrends(series)
      expect(insights.length).toBe(0)
    })
  })

  describe('checkThresholds', () => {
    const seriesArr: DataSeries[] = [
      {
        label: 'expense-ratio',
        points: [
          { period: '2025-01', value: 70 },
          { period: '2025-02', value: 72 },
          { period: '2025-03', value: 85 },
        ],
      },
    ]

    it('triggers when value exceeds threshold', () => {
      const rules: ThresholdRule[] = [
        { metric: 'expense-ratio', operator: 'gt', value: 80, severity: 'warning', title: 'High expense ratio', suggestedAction: 'Review expenses' },
      ]
      const insights = checkThresholds(seriesArr, rules)
      expect(insights.length).toBe(1)
      expect(insights[0].severity).toBe('warning')
    })

    it('triggers when value is below threshold', () => {
      const rules: ThresholdRule[] = [
        { metric: 'expense-ratio', operator: 'lt', value: 90, severity: 'info', title: 'Low expense', suggestedAction: 'Monitor' },
      ]
      const insights = checkThresholds(seriesArr, rules)
      expect(insights.length).toBe(1)
    })

    it('does not trigger rules for non-matching metrics', () => {
      const rules: ThresholdRule[] = [
        { metric: 'other-metric', operator: 'gt', value: 0, severity: 'critical', title: 'Irrelevant', suggestedAction: 'N/A' },
      ]
      const insights = checkThresholds(seriesArr, rules)
      expect(insights.length).toBe(0)
    })
  })

  describe('runInsightEngine', () => {
    it('combines all analyses into a sorted list', () => {
      const result = runInsightEngine({
        orgId: 'org-1',
        series: [
          {
            label: 'revenue',
            points: [
              { period: '2025-01', value: 100 },
              { period: '2025-02', value: 102 },
              { period: '2025-03', value: 101 },
              { period: '2025-04', value: 99 },
              { period: '2025-05', value: 100 },
              { period: '2025-06', value: 300 },
            ],
          },
        ],
        thresholdRules: [
          { metric: 'revenue', operator: 'gt', value: 250, severity: 'critical', title: 'Revenue spike', suggestedAction: 'Investigate spike' },
        ],
      })
      expect(result.insights.length).toBeGreaterThan(0)
      // should be sorted by severity (critical first)
      const severityOrder = ['critical', 'warning', 'info']
      for (let i = 1; i < result.insights.length; i++) {
        const prev = severityOrder.indexOf(result.insights[i - 1].severity)
        const curr = severityOrder.indexOf(result.insights[i].severity)
        expect(prev).toBeLessThanOrEqual(curr)
      }
    })

    it('returns empty insights for clean data', () => {
      const result = runInsightEngine({
        orgId: 'org-1',
        series: [
          {
            label: 'cost',
            points: [
              { period: '2025-01', value: 50 },
              { period: '2025-02', value: 51 },
              { period: '2025-03', value: 50 },
              { period: '2025-04', value: 49 },
              { period: '2025-05', value: 50 },
            ],
          },
        ],
        thresholdRules: [],
      })
      expect(result.insights.length).toBe(0)
    })
  })
})
