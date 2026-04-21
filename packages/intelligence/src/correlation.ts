/**
 * @nzila/intelligence — Cross-Domain Signal Correlation
 *
 * Provides lightweight statistical correlation across app/domain signals so
 * NIL can surface relationships between operational domains.
 */

import type {
  CrossDomainCorrelation,
  DomainSignal,
  CorrelationStrength,
} from './types'

function toUtcDay(isoTimestamp: string): string {
  const date = new Date(isoTimestamp)
  if (Number.isNaN(date.getTime())) return isoTimestamp.slice(0, 10)
  return date.toISOString().slice(0, 10)
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/** Pearson product-moment correlation coefficient. */
export function pearsonCorrelation(x: readonly number[], y: readonly number[]): number {
  if (x.length !== y.length || x.length < 2) return 0

  const mx = mean(x)
  const my = mean(y)

  let numerator = 0
  let sumSqX = 0
  let sumSqY = 0

  for (let i = 0; i < x.length; i++) {
    const xValue = x[i]
    const yValue = y[i]
    if (xValue === undefined || yValue === undefined) continue

    const dx = xValue - mx
    const dy = yValue - my
    numerator += dx * dy
    sumSqX += dx * dx
    sumSqY += dy * dy
  }

  const denominator = Math.sqrt(sumSqX * sumSqY)
  if (denominator === 0) return 0
  return numerator / denominator
}

export function classifyCorrelationStrength(coefficient: number): CorrelationStrength {
  const abs = Math.abs(coefficient)
  if (abs >= 0.8) return 'very_strong'
  if (abs >= 0.6) return 'strong'
  if (abs >= 0.4) return 'moderate'
  if (abs >= 0.2) return 'weak'
  return 'none'
}

function buildSeriesByDay(signals: readonly DomainSignal[]): Map<string, number> {
  const grouped = new Map<string, { sum: number; count: number }>()

  for (const signal of signals) {
    const day = toUtcDay(signal.timestamp)
    const prev = grouped.get(day) ?? { sum: 0, count: 0 }
    prev.sum += signal.value
    prev.count += 1
    grouped.set(day, prev)
  }

  const series = new Map<string, number>()
  for (const [day, agg] of grouped) {
    series.set(day, agg.sum / agg.count)
  }
  return series
}

/**
 * Detects statistically meaningful correlations between pairs of app+metric
 * signals over overlapping day buckets.
 */
export function detectCrossDomainCorrelations(params: {
  readonly signals: readonly DomainSignal[]
  readonly minSamples?: number
  readonly minAbsoluteCoefficient?: number
}): CrossDomainCorrelation[] {
  const minSamples = params.minSamples ?? 5
  const minAbs = params.minAbsoluteCoefficient ?? 0.5

  const bySeriesKey = new Map<string, DomainSignal[]>()
  for (const signal of params.signals) {
    const key = `${signal.app}:${signal.metric}`
    const arr = bySeriesKey.get(key) ?? []
    arr.push(signal)
    bySeriesKey.set(key, arr)
  }

  const entries = Array.from(bySeriesKey.entries())
  const results: CrossDomainCorrelation[] = []

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const leftEntry = entries[i]
      const rightEntry = entries[j]
      if (!leftEntry || !rightEntry) continue

      const [leftKey, leftSignals] = leftEntry
      const [rightKey, rightSignals] = rightEntry

      const [leftApp, leftMetric] = leftKey.split(':')
      const [rightApp, rightMetric] = rightKey.split(':')
      if (!leftApp || !leftMetric || !rightApp || !rightMetric) continue

      // Focus on cross-domain relationships only.
      if (leftApp === rightApp) continue

      const leftSeries = buildSeriesByDay(leftSignals)
      const rightSeries = buildSeriesByDay(rightSignals)

      const overlapDays = Array.from(leftSeries.keys()).filter((day) => rightSeries.has(day))
      if (overlapDays.length < minSamples) continue

      const x = overlapDays.map((day) => leftSeries.get(day) ?? 0)
      const y = overlapDays.map((day) => rightSeries.get(day) ?? 0)

      const coefficient = pearsonCorrelation(x, y)
      if (Math.abs(coefficient) < minAbs) continue

      const strength = classifyCorrelationStrength(coefficient)
      const direction = coefficient >= 0 ? 'positive' : 'negative'

      const overlapStart = overlapDays[0]
      const overlapEnd = overlapDays[overlapDays.length - 1]
      if (!overlapStart || !overlapEnd) continue

      results.push({
        id: `${leftKey}|${rightKey}`,
        left: { app: leftApp, metric: leftMetric },
        right: { app: rightApp, metric: rightMetric },
        coefficient,
        strength,
        direction,
        sampleSize: overlapDays.length,
        overlapStart,
        overlapEnd,
      })
    }
  }

  results.sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient))
  return results
}
