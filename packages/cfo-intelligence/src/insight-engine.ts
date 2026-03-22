/**
 * @nzila/cfo-intelligence — Insight Engine
 *
 * AI-powered anomaly detection, insight generation, and actionable
 * suggestions for CFO dashboards. Analyses financial data series
 * and surfaces meaningful patterns without requiring external ML
 * infrastructure at runtime.
 *
 * @module @nzila/cfo-intelligence/insight-engine
 */

// ── Types ───────────────────────────────────────────────────────────────────

export type InsightSeverity = 'critical' | 'warning' | 'info'
export type InsightCategory =
  | 'anomaly'
  | 'trend'
  | 'threshold'
  | 'optimization'
  | 'forecast-drift'

export interface DataSeries {
  label: string
  points: { period: string; value: number }[]
}

export interface FinancialInsight {
  id: string
  category: InsightCategory
  severity: InsightSeverity
  title: string
  explanation: string
  suggestedAction: string
  metric: string
  currentValue: number
  referenceValue: number
  deviationPct: number
  detectedAt: string
}

export interface AnomalyDetectionConfig {
  /** Number of standard deviations to flag as anomaly (default: 2) */
  zScoreThreshold?: number
  /** Minimum data points required for anomaly detection (default: 4) */
  minDataPoints?: number
}

export interface ThresholdRule {
  metric: string
  operator: 'gt' | 'lt'
  value: number
  severity: InsightSeverity
  title: string
  suggestedAction: string
}

export interface InsightEngineInput {
  orgId: string
  series: DataSeries[]
  thresholdRules?: ThresholdRule[]
  anomalyConfig?: AnomalyDetectionConfig
}

export interface InsightEngineResult {
  orgId: string
  insights: FinancialInsight[]
  analysedAt: string
  seriesCount: number
  totalDataPoints: number
}

// ── Anomaly detection ───────────────────────────────────────────────────────

/**
 * Detect statistical anomalies in a data series using z-score analysis.
 * Points beyond the z-score threshold from the mean are flagged.
 */
export function detectAnomalies(
  series: DataSeries,
  config: AnomalyDetectionConfig = {},
): FinancialInsight[] {
  const threshold = config.zScoreThreshold ?? 2
  const minPoints = config.minDataPoints ?? 4
  const insights: FinancialInsight[] = []

  if (series.points.length < minPoints) return insights

  const values = series.points.map((p) => p.value)
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
  const sd = Math.sqrt(variance)

  if (sd === 0) return insights // All identical values, no anomaly

  for (const point of series.points) {
    const zScore = Math.abs((point.value - mean) / sd)
    if (zScore >= threshold) {
      const deviationPct = round2(((point.value - mean) / mean) * 100)
      const direction = point.value > mean ? 'spike' : 'drop'
      insights.push({
        id: `anomaly-${series.label}-${point.period}`,
        category: 'anomaly',
        severity: zScore >= 3 ? 'critical' : 'warning',
        title: `${series.label}: unusual ${direction} in ${point.period}`,
        explanation: `${series.label} was ${Math.abs(deviationPct)}% ${direction === 'spike' ? 'above' : 'below'} the mean (${round2(mean)}) in ${point.period}. Z-score: ${round2(zScore)}.`,
        suggestedAction: direction === 'spike'
          ? `Investigate the cause of the ${series.label} spike in ${point.period}`
          : `Investigate the cause of the ${series.label} drop in ${point.period}`,
        metric: series.label,
        currentValue: point.value,
        referenceValue: round2(mean),
        deviationPct,
        detectedAt: new Date().toISOString(),
      })
    }
  }

  return insights
}

// ── Trend detection ─────────────────────────────────────────────────────────

/**
 * Detect significant trends (sustained increase or decrease) in a series.
 * Uses a simple consecutive-direction-change test.
 */
export function detectTrends(series: DataSeries): FinancialInsight[] {
  const insights: FinancialInsight[] = []
  const pts = series.points

  if (pts.length < 3) return insights

  // Count consecutive increases / decreases
  let consecutiveUp = 0
  let consecutiveDown = 0

  for (let i = 1; i < pts.length; i++) {
    if (pts[i].value > pts[i - 1].value) {
      consecutiveUp++
      consecutiveDown = 0
    } else if (pts[i].value < pts[i - 1].value) {
      consecutiveDown++
      consecutiveUp = 0
    } else {
      consecutiveUp = 0
      consecutiveDown = 0
    }
  }

  const first = pts[0].value
  const last = pts[pts.length - 1].value
  const totalChange = first !== 0 ? round2(((last - first) / first) * 100) : 0

  if (consecutiveUp >= 3) {
    insights.push({
      id: `trend-up-${series.label}`,
      category: 'trend',
      severity: 'info',
      title: `${series.label}: sustained upward trend`,
      explanation: `${series.label} has increased for ${consecutiveUp} consecutive periods (${totalChange > 0 ? '+' : ''}${totalChange}% overall).`,
      suggestedAction: `Review whether the ${series.label} growth is sustainable and aligned with targets`,
      metric: series.label,
      currentValue: last,
      referenceValue: first,
      deviationPct: totalChange,
      detectedAt: new Date().toISOString(),
    })
  }

  if (consecutiveDown >= 3) {
    insights.push({
      id: `trend-down-${series.label}`,
      category: 'trend',
      severity: 'warning',
      title: `${series.label}: sustained downward trend`,
      explanation: `${series.label} has declined for ${consecutiveDown} consecutive periods (${totalChange}% overall).`,
      suggestedAction: `Investigate root causes of declining ${series.label} and consider corrective actions`,
      metric: series.label,
      currentValue: last,
      referenceValue: first,
      deviationPct: totalChange,
      detectedAt: new Date().toISOString(),
    })
  }

  return insights
}

// ── Threshold checks ────────────────────────────────────────────────────────

/**
 * Check the latest value in each series against threshold rules.
 */
export function checkThresholds(
  series: DataSeries[],
  rules: ThresholdRule[],
): FinancialInsight[] {
  const insights: FinancialInsight[] = []

  for (const rule of rules) {
    const s = series.find((ds) => ds.label === rule.metric)
    if (!s || s.points.length === 0) continue

    const latest = s.points[s.points.length - 1]
    let triggered = false

    if (rule.operator === 'gt' && latest.value > rule.value) triggered = true
    if (rule.operator === 'lt' && latest.value < rule.value) triggered = true

    if (triggered) {
      const deviationPct = rule.value !== 0
        ? round2(((latest.value - rule.value) / rule.value) * 100)
        : 0
      insights.push({
        id: `threshold-${rule.metric}-${latest.period}`,
        category: 'threshold',
        severity: rule.severity,
        title: rule.title,
        explanation: `${rule.metric} is ${latest.value} (threshold: ${rule.operator === 'gt' ? '>' : '<'} ${rule.value}).`,
        suggestedAction: rule.suggestedAction,
        metric: rule.metric,
        currentValue: latest.value,
        referenceValue: rule.value,
        deviationPct,
        detectedAt: new Date().toISOString(),
      })
    }
  }

  return insights
}

// ── Composite engine ────────────────────────────────────────────────────────

/**
 * Run the full insight engine: anomaly detection + trend analysis +
 * threshold checks across all provided series.
 */
export function runInsightEngine(input: InsightEngineInput): InsightEngineResult {
  const allInsights: FinancialInsight[] = []

  for (const series of input.series) {
    allInsights.push(...detectAnomalies(series, input.anomalyConfig))
    allInsights.push(...detectTrends(series))
  }

  if (input.thresholdRules) {
    allInsights.push(...checkThresholds(input.series, input.thresholdRules))
  }

  // Sort by severity: critical → warning → info
  const severityOrder: Record<InsightSeverity, number> = { critical: 0, warning: 1, info: 2 }
  allInsights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  return {
    orgId: input.orgId,
    insights: allInsights,
    analysedAt: new Date().toISOString(),
    seriesCount: input.series.length,
    totalDataPoints: input.series.reduce((s, ds) => s + ds.points.length, 0),
  }
}

// ── Utility ─────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
