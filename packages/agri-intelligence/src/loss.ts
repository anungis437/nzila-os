// ---------------------------------------------------------------------------
// Loss rate intelligence — deterministic V1
// ---------------------------------------------------------------------------

/** Loss rate result for a set of batches between harvest and delivery */
export interface LossRateResult {
  totalHarvestedKg: number
  totalDeliveredKg: number
  lossKg: number
  lossPercent: number
  batchCount: number
}

/** Batch weight pair for loss computation */
export interface BatchWeightPair {
  harvestedKg: number
  deliveredKg: number
}

export interface TimedBatchWeightPair extends BatchWeightPair {
  timestamp: string
}

export interface LossAnomaly {
  index: number
  lossPercent: number
  zScore: number
}

export interface LossDriftResult {
  baselineLossPercent: number
  recentLossPercent: number
  driftPercentPoints: number
  driftRatio: number
  alert: boolean
}

// ---------------------------------------------------------------------------
// Pure computations
// ---------------------------------------------------------------------------

/**
 * Compute aggregate loss rate across a set of batch weight pairs.
 * Loss % = ((harvested - delivered) / harvested) × 100
 */
export function computeLossRate(pairs: BatchWeightPair[]): LossRateResult {
  const totalHarvestedKg = pairs.reduce((s, p) => s + p.harvestedKg, 0)
  const totalDeliveredKg = pairs.reduce((s, p) => s + p.deliveredKg, 0)
  const lossKg = totalHarvestedKg - totalDeliveredKg
  return {
    totalHarvestedKg,
    totalDeliveredKg,
    lossKg,
    lossPercent: totalHarvestedKg > 0 ? (lossKg / totalHarvestedKg) * 100 : 0,
    batchCount: pairs.length,
  }
}

/**
 * Compute loss rate per crop from tagged batch pairs.
 */
export function computeLossRateByCrop(
  pairs: Array<BatchWeightPair & { cropId: string }>,
): Map<string, LossRateResult> {
  const grouped = new Map<string, Array<BatchWeightPair & { cropId: string }>>()
  for (const p of pairs) {
    const arr = grouped.get(p.cropId) ?? []
    arr.push(p)
    grouped.set(p.cropId, arr)
  }
  const results = new Map<string, LossRateResult>()
  for (const [cropId, group] of grouped) {
    results.set(cropId, computeLossRate(group))
  }
  return results
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function standardDeviation(values: readonly number[]): number {
  if (values.length < 2) return 0
  const mu = mean(values)
  const variance = values.reduce((sum, value) => sum + (value - mu) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

/**
 * Detect anomalous loss batches using classical z-score.
 */
export function detectLossAnomalies(
  pairs: BatchWeightPair[],
  zThreshold: number = 2.5,
): LossAnomaly[] {
  if (pairs.length === 0) return []

  const lossPercents = pairs.map((pair) =>
    pair.harvestedKg > 0 ? ((pair.harvestedKg - pair.deliveredKg) / pair.harvestedKg) * 100 : 0,
  )

  const mu = mean(lossPercents)
  const sigma = standardDeviation(lossPercents)
  if (sigma === 0) return []

  const anomalies: LossAnomaly[] = []
  for (let i = 0; i < lossPercents.length; i++) {
    const zScore = (lossPercents[i] - mu) / sigma
    if (Math.abs(zScore) >= zThreshold) {
      anomalies.push({
        index: i,
        lossPercent: lossPercents[i],
        zScore,
      })
    }
  }

  anomalies.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore))
  return anomalies
}

/**
 * Compare recent window loss vs baseline to detect trend drift.
 */
export function detectLossDrift(
  pairs: TimedBatchWeightPair[],
  recentWindow: number = 10,
  alertThresholdPercentPoints: number = 3,
): LossDriftResult {
  if (pairs.length === 0) {
    return {
      baselineLossPercent: 0,
      recentLossPercent: 0,
      driftPercentPoints: 0,
      driftRatio: 0,
      alert: false,
    }
  }

  const sorted = [...pairs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  )
  const splitIndex = Math.max(1, sorted.length - recentWindow)
  const baseline = sorted.slice(0, splitIndex)
  const recent = sorted.slice(splitIndex)

  const baselineLossPercent = computeLossRate(baseline).lossPercent
  const recentLossPercent = computeLossRate(recent).lossPercent
  const driftPercentPoints = recentLossPercent - baselineLossPercent
  const driftRatio = baselineLossPercent === 0
    ? (recentLossPercent > 0 ? 1 : 0)
    : driftPercentPoints / baselineLossPercent

  return {
    baselineLossPercent,
    recentLossPercent,
    driftPercentPoints,
    driftRatio,
    alert: Math.abs(driftPercentPoints) >= alertThresholdPercentPoints,
  }
}
