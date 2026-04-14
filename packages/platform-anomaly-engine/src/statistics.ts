/**
 * @nzila/platform-anomaly-engine — Statistical Methods
 *
 * Production-grade anomaly detection algorithms:
 * - Z-score (modified for robustness using MAD)
 * - IQR (Tukey's fences)
 * - Grubbs' test (assumes normality)
 * - Exponential moving average (EMA) with adaptive bands
 * - Seasonal decomposition (additive model)
 * - Multi-metric Pearson correlation
 */

// ── Core Statistics ─────────────────────────────────────────────────────────

export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

export function standardDeviation(values: readonly number[]): number {
  if (values.length < 2) return 0
  const m = mean(values)
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

/**
 * Median Absolute Deviation — robust alternative to standard deviation.
 * MAD = median(|Xi - median(X)|)
 * Scaled MAD ≈ 1.4826 × MAD (consistency constant for normal distributions)
 */
export function medianAbsoluteDeviation(values: readonly number[]): number {
  if (values.length < 2) return 0
  const med = median(values)
  const absDeviations = values.map((v) => Math.abs(v - med))
  return median(absDeviations)
}

export function scaledMAD(values: readonly number[]): number {
  return 1.4826 * medianAbsoluteDeviation(values)
}

// ── Z-Score (Modified) ──────────────────────────────────────────────────────

export interface ZScoreResult {
  index: number
  value: number
  zScore: number
  isAnomaly: boolean
}

/**
 * Modified Z-score using MAD instead of standard deviation.
 * More robust against outliers than classical z-score.
 * Iglewicz & Hoaglin (1993): |modified z| > 3.5 is anomalous.
 */
export function modifiedZScore(
  values: readonly number[],
  threshold = 3.5,
): ZScoreResult[] {
  if (values.length < 3) return []
  const med = median(values)
  const mad = medianAbsoluteDeviation(values)
  if (mad === 0) return []

  return values.map((value, index) => {
    const zScore = (0.6745 * (value - med)) / mad
    return { index, value, zScore, isAnomaly: Math.abs(zScore) > threshold }
  })
}

/**
 * Classical z-score for cases where data is known to be normally distributed.
 */
export function classicalZScore(
  values: readonly number[],
  threshold = 3.0,
): ZScoreResult[] {
  if (values.length < 3) return []
  const m = mean(values)
  const sd = standardDeviation(values)
  if (sd === 0) return []

  return values.map((value, index) => {
    const zScore = (value - m) / sd
    return { index, value, zScore, isAnomaly: Math.abs(zScore) > threshold }
  })
}

// ── IQR (Tukey's Fences) ────────────────────────────────────────────────────

export interface IQRResult {
  q1: number
  q3: number
  iqr: number
  lowerFence: number
  upperFence: number
  anomalies: Array<{ index: number; value: number; direction: 'low' | 'high' }>
}

function percentile(sorted: readonly number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(idx)
  const upper = Math.ceil(idx)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower)
}

/**
 * Tukey's fences using IQR.
 * Inner fences: Q1 - k×IQR, Q3 + k×IQR (k=1.5 for outliers, k=3.0 for extreme)
 */
export function iqrDetect(
  values: readonly number[],
  k = 1.5,
): IQRResult {
  const sorted = [...values].sort((a, b) => a - b)
  const q1 = percentile(sorted, 25)
  const q3 = percentile(sorted, 75)
  const iqr = q3 - q1
  const lowerFence = q1 - k * iqr
  const upperFence = q3 + k * iqr

  const anomalies: IQRResult['anomalies'] = []
  for (let i = 0; i < values.length; i++) {
    if (values[i] < lowerFence) anomalies.push({ index: i, value: values[i], direction: 'low' })
    else if (values[i] > upperFence) anomalies.push({ index: i, value: values[i], direction: 'high' })
  }

  return { q1, q3, iqr, lowerFence, upperFence, anomalies }
}

// ── Grubbs' Test ────────────────────────────────────────────────────────────

export interface GrubbsResult {
  testStatistic: number
  criticalValue: number
  isAnomaly: boolean
  suspectIndex: number
  suspectValue: number
}

/**
 * Grubbs' test for a single outlier (two-sided).
 * Test statistic: G = max|Xi - X̄| / s
 * Uses approximate critical values for α = 0.05.
 */
export function grubbsTest(values: readonly number[]): GrubbsResult | null {
  const n = values.length
  if (n < 3) return null

  const m = mean(values)
  const sd = standardDeviation(values)
  if (sd === 0) return null

  let maxDeviation = 0
  let suspectIndex = 0
  for (let i = 0; i < values.length; i++) {
    const dev = Math.abs(values[i] - m)
    if (dev > maxDeviation) {
      maxDeviation = dev
      suspectIndex = i
    }
  }

  const testStatistic = maxDeviation / sd

  // Approximate critical value using t-distribution approximation
  // For α = 0.05 (two-sided), this is a conservative approximation
  const tCritSquared = grubbsTCritical(n)
  const criticalValue = ((n - 1) / Math.sqrt(n)) * Math.sqrt(tCritSquared / (n - 2 + tCritSquared))

  return {
    testStatistic,
    criticalValue,
    isAnomaly: testStatistic > criticalValue,
    suspectIndex,
    suspectValue: values[suspectIndex],
  }
}

/**
 * Approximate t² critical values for Grubbs' test (α = 0.05, two-sided).
 * Derived from t-distribution quantiles.
 */
function grubbsTCritical(n: number): number {
  // t²(α/(2n), n-2) approximation for common sample sizes
  // These are pre-computed for efficiency
  if (n <= 3) return 12.706 ** 2
  if (n <= 5) return 8.610
  if (n <= 10) return 5.598
  if (n <= 15) return 4.880
  if (n <= 20) return 4.539
  if (n <= 30) return 4.237
  if (n <= 50) return 3.977
  if (n <= 100) return 3.787
  return 3.646 // n > 100
}

// ── Exponential Moving Average ──────────────────────────────────────────────

export interface EMABand {
  index: number
  value: number
  ema: number
  upper: number
  lower: number
  isAnomaly: boolean
  deviationFromEMA: number
}

/**
 * EMA with adaptive Bollinger-like bands.
 * α = 2/(span+1)
 * Bands = EMA ± k × EMA-based standard deviation (rolling window)
 */
export function emaWithBands(
  values: readonly number[],
  span = 7,
  bandWidth = 2.0,
  rollingWindow = 20,
): EMABand[] {
  if (values.length < 2) return []

  const alpha = 2 / (span + 1)
  const results: EMABand[] = []
  let ema = values[0]

  for (let i = 0; i < values.length; i++) {
    ema = i === 0 ? values[0] : alpha * values[i] + (1 - alpha) * ema

    // Compute rolling std of residuals for adaptive bands
    const windowStart = Math.max(0, i - rollingWindow + 1)
    const windowValues = values.slice(windowStart, i + 1)
    const residuals = windowValues.map((v, j) => {
      // Approximate EMA at each window point
      const idx = windowStart + j
      let localEma = values[0]
      for (let k = 1; k <= idx; k++) {
        localEma = alpha * values[k] + (1 - alpha) * localEma
      }
      return v - localEma
    })
    const residualStd = standardDeviation(residuals)

    const upper = ema + bandWidth * residualStd
    const lower = ema - bandWidth * residualStd
    const deviationFromEMA = residualStd > 0 ? (values[i] - ema) / residualStd : 0

    results.push({
      index: i,
      value: values[i],
      ema,
      upper,
      lower,
      isAnomaly: values[i] > upper || values[i] < lower,
      deviationFromEMA,
    })
  }

  return results
}

// ── Seasonal Decomposition ──────────────────────────────────────────────────

export interface SeasonalDecomposition {
  trend: number[]
  seasonal: number[]
  residual: number[]
  anomalies: Array<{ index: number; residual: number; isAnomaly: boolean }>
}

/**
 * Additive seasonal decomposition using centered moving average.
 * X(t) = Trend(t) + Seasonal(t) + Residual(t)
 *
 * @param values - Time series data
 * @param period - Seasonal period (e.g. 7 for weekly, 12 for monthly)
 * @param residualThreshold - Z-score threshold for residual anomalies
 */
export function seasonalDecompose(
  values: readonly number[],
  period: number,
  residualThreshold = 2.5,
): SeasonalDecomposition {
  const n = values.length
  if (n < period * 2) {
    return { trend: [...values], seasonal: Array(n).fill(0), residual: Array(n).fill(0), anomalies: [] }
  }

  // Step 1: Centered moving average for trend
  const trend: number[] = Array(n).fill(0)
  const halfPeriod = Math.floor(period / 2)
  for (let i = halfPeriod; i < n - halfPeriod; i++) {
    let sum = 0
    for (let j = i - halfPeriod; j <= i + halfPeriod; j++) {
      sum += values[j]
    }
    trend[i] = sum / (2 * halfPeriod + 1)
  }
  // Extend trend to edges using nearest computed value
  for (let i = 0; i < halfPeriod; i++) trend[i] = trend[halfPeriod]
  for (let i = n - halfPeriod; i < n; i++) trend[i] = trend[n - halfPeriod - 1]

  // Step 2: Detrended series → seasonal component
  const detrended = values.map((v, i) => v - trend[i])
  const seasonal: number[] = Array(n).fill(0)
  for (let s = 0; s < period; s++) {
    const seasonValues: number[] = []
    for (let i = s; i < n; i += period) {
      seasonValues.push(detrended[i])
    }
    const seasonMean = mean(seasonValues)
    for (let i = s; i < n; i += period) {
      seasonal[i] = seasonMean
    }
  }

  // Step 3: Residual = observed - trend - seasonal
  const residual = values.map((v, i) => v - trend[i] - seasonal[i])

  // Step 4: Flag anomalous residuals using z-score
  const residualMean = mean(residual)
  const residualStd = standardDeviation(residual)
  const anomalies = residual
    .map((r, index) => ({
      index,
      residual: r,
      isAnomaly: residualStd > 0 ? Math.abs((r - residualMean) / residualStd) > residualThreshold : false,
    }))
    .filter((a) => a.isAnomaly)

  return { trend, seasonal, residual, anomalies }
}

// ── Multi-Metric Correlation ────────────────────────────────────────────────

export interface CorrelationResult {
  metricA: string
  metricB: string
  pearsonR: number
  strength: 'none' | 'weak' | 'moderate' | 'strong' | 'very_strong'
  direction: 'positive' | 'negative' | 'none'
}

/**
 * Pearson correlation coefficient between two metric time series.
 * r = Σ((Xi-X̄)(Yi-Ȳ)) / √(Σ(Xi-X̄)² × Σ(Yi-Ȳ)²)
 */
export function pearsonCorrelation(
  metricA: string,
  valuesA: readonly number[],
  metricB: string,
  valuesB: readonly number[],
): CorrelationResult {
  const n = Math.min(valuesA.length, valuesB.length)
  if (n < 3) return { metricA, metricB, pearsonR: 0, strength: 'none', direction: 'none' }

  const a = valuesA.slice(0, n)
  const b = valuesB.slice(0, n)
  const meanA = mean(a)
  const meanB = mean(b)

  let sumAB = 0
  let sumA2 = 0
  let sumB2 = 0
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA
    const db = b[i] - meanB
    sumAB += da * db
    sumA2 += da * da
    sumB2 += db * db
  }

  const denom = Math.sqrt(sumA2 * sumB2)
  const r = denom === 0 ? 0 : sumAB / denom

  const absR = Math.abs(r)
  const strength: CorrelationResult['strength'] =
    absR >= 0.9 ? 'very_strong' :
    absR >= 0.7 ? 'strong' :
    absR >= 0.4 ? 'moderate' :
    absR >= 0.2 ? 'weak' : 'none'

  const direction: CorrelationResult['direction'] =
    absR < 0.2 ? 'none' : r > 0 ? 'positive' : 'negative'

  return { metricA, metricB, pearsonR: Math.round(r * 10000) / 10000, strength, direction }
}

/**
 * Compute correlation matrix for multiple metric time series.
 * Returns all unique pairs.
 */
export function correlationMatrix(
  metrics: Array<{ name: string; values: readonly number[] }>,
): CorrelationResult[] {
  const results: CorrelationResult[] = []
  for (let i = 0; i < metrics.length; i++) {
    for (let j = i + 1; j < metrics.length; j++) {
      results.push(
        pearsonCorrelation(
          metrics[i].name,
          metrics[i].values,
          metrics[j].name,
          metrics[j].values,
        ),
      )
    }
  }
  return results
}

// ── Change Point Detection (CUSUM) ──────────────────────────────────────────

export interface ChangePoint {
  index: number
  value: number
  cumulativeSum: number
  direction: 'increase' | 'decrease'
}

/**
 * CUSUM (Cumulative Sum) change point detection.
 * Detects shifts in the mean of a time series.
 * Threshold is expressed in standard deviations.
 */
export function cusumDetect(
  values: readonly number[],
  threshold = 4.0,
  drift = 0.5,
): ChangePoint[] {
  if (values.length < 5) return []

  const m = mean(values)
  const sd = standardDeviation(values)
  if (sd === 0) return []

  const h = threshold * sd
  const k = drift * sd

  let sPlus = 0
  let sMinus = 0
  const changePoints: ChangePoint[] = []

  for (let i = 0; i < values.length; i++) {
    sPlus = Math.max(0, sPlus + values[i] - m - k)
    sMinus = Math.max(0, sMinus - values[i] + m - k)

    if (sPlus > h) {
      changePoints.push({ index: i, value: values[i], cumulativeSum: sPlus, direction: 'increase' })
      sPlus = 0
    }
    if (sMinus > h) {
      changePoints.push({ index: i, value: values[i], cumulativeSum: sMinus, direction: 'decrease' })
      sMinus = 0
    }
  }

  return changePoints
}
