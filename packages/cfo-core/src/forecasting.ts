/**
 * @nzila/cfo-core — Forecasting Model Hardening
 *
 * Every forecast is versioned, explainable, and reproducible.
 * Each projection output includes:
 *  - model_type (linear, moving-average, weighted-average)
 *  - assumptions (explicit list of what was assumed)
 *  - input_data (the actual data fed to the model)
 *  - output_projection (the computed forecast values)
 *  - confidence_range (low / high bounds)
 *  - generated_at (ISO timestamp)
 *
 * @module @nzila/cfo-core/forecasting
 */

import { generateFinancialProof, type FinancialProof } from './financial-proof'
import type { ProvenResult } from './financial-engine'

export const FORECASTING_VERSION = '1.0.0'

// ── Types ───────────────────────────────────────────────────────────────────

export type ForecastModelType = 'linear' | 'moving-average' | 'weighted-average'

export interface ForecastInput {
  orgId: string
  reportId: string
  modelType: ForecastModelType
  assumptions: string[]
  inputData: ForecastDataPoint[]
  periodsToForecast: number
}

export interface ForecastDataPoint {
  period: string // e.g. "2026-01", "2026-Q1"
  value: number
}

export interface ForecastProjection {
  period: string
  forecast: number
  confidenceLow: number
  confidenceHigh: number
}

export interface ForecastResult {
  orgId: string
  modelType: ForecastModelType
  modelVersion: string
  assumptions: string[]
  inputData: ForecastDataPoint[]
  projections: ForecastProjection[]
  generatedAt: string
}

// ── Model implementations ───────────────────────────────────────────────────

/**
 * Linear trend: fit y = a + bx via least-squares, extrapolate.
 */
function linearForecast(data: ForecastDataPoint[], periods: number): ForecastProjection[] {
  const n = data.length
  if (n < 2) return fillFlat(data, periods)

  const xs = data.map((_, i) => i)
  const ys = data.map((d) => d.value)

  const xMean = xs.reduce((a, b) => a + b, 0) / n
  const yMean = ys.reduce((a, b) => a + b, 0) / n

  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (ys[i] - yMean)
    den += (xs[i] - xMean) ** 2
  }

  const slope = den !== 0 ? num / den : 0
  const intercept = yMean - slope * xMean

  // Residual standard error for confidence band
  const residuals = ys.map((y, i) => y - (intercept + slope * xs[i]))
  const sse = residuals.reduce((s, r) => s + r * r, 0)
  const se = n > 2 ? Math.sqrt(sse / (n - 2)) : 0

  const projections: ForecastProjection[] = []
  for (let i = 0; i < periods; i++) {
    const x = n + i
    const forecast = round2(intercept + slope * x)
    const margin = round2(1.96 * se) // ~95% CI
    projections.push({
      period: nextPeriodLabel(data[n - 1].period, i + 1),
      forecast,
      confidenceLow: round2(forecast - margin),
      confidenceHigh: round2(forecast + margin),
    })
  }

  return projections
}

/**
 * Simple moving average with configurable window (defaults to all data).
 */
function movingAverageForecast(data: ForecastDataPoint[], periods: number): ForecastProjection[] {
  if (data.length === 0) return []

  const values = data.map((d) => d.value)
  const window = Math.min(values.length, 6) // last 6 periods or all data
  const recent = values.slice(-window)
  const avg = round2(recent.reduce((a, b) => a + b, 0) / recent.length)

  // Std dev for confidence
  const variance = recent.reduce((s, v) => s + (v - avg) ** 2, 0) / recent.length
  const sd = Math.sqrt(variance)

  const projections: ForecastProjection[] = []
  for (let i = 0; i < periods; i++) {
    projections.push({
      period: nextPeriodLabel(data[data.length - 1].period, i + 1),
      forecast: avg,
      confidenceLow: round2(avg - 1.96 * sd),
      confidenceHigh: round2(avg + 1.96 * sd),
    })
  }

  return projections
}

/**
 * Weighted moving average — more weight on recent periods.
 */
function weightedAverageForecast(data: ForecastDataPoint[], periods: number): ForecastProjection[] {
  if (data.length === 0) return []

  const values = data.map((d) => d.value)
  const window = Math.min(values.length, 6)
  const recent = values.slice(-window)

  // Weights: 1, 2, 3, ... window
  const weights = recent.map((_, i) => i + 1)
  const totalWeight = weights.reduce((a, b) => a + b, 0)
  const weightedAvg = round2(
    recent.reduce((s, v, i) => s + v * weights[i], 0) / totalWeight,
  )

  // Weighted variance
  const wVariance = recent.reduce(
    (s, v, i) => s + weights[i] * (v - weightedAvg) ** 2,
    0,
  ) / totalWeight
  const sd = Math.sqrt(wVariance)

  const projections: ForecastProjection[] = []
  for (let i = 0; i < periods; i++) {
    projections.push({
      period: nextPeriodLabel(data[data.length - 1].period, i + 1),
      forecast: weightedAvg,
      confidenceLow: round2(weightedAvg - 1.96 * sd),
      confidenceHigh: round2(weightedAvg + 1.96 * sd),
    })
  }

  return projections
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Run a forecast using the specified model type. Returns a proven result
 * with an attached financial proof.
 */
export function runForecast(input: ForecastInput): ProvenResult<ForecastResult> {
  let projections: ForecastProjection[]

  switch (input.modelType) {
    case 'linear':
      projections = linearForecast(input.inputData, input.periodsToForecast)
      break
    case 'moving-average':
      projections = movingAverageForecast(input.inputData, input.periodsToForecast)
      break
    case 'weighted-average':
      projections = weightedAverageForecast(input.inputData, input.periodsToForecast)
      break
  }

  const data: ForecastResult = {
    orgId: input.orgId,
    modelType: input.modelType,
    modelVersion: FORECASTING_VERSION,
    assumptions: input.assumptions,
    inputData: input.inputData,
    projections,
    generatedAt: new Date().toISOString(),
  }

  const outputValues: Record<string, number> = {}
  for (let i = 0; i < projections.length; i++) {
    outputValues[`forecast_${i}`] = projections[i].forecast
    outputValues[`low_${i}`] = projections[i].confidenceLow
    outputValues[`high_${i}`] = projections[i].confidenceHigh
  }

  const proof = generateFinancialProof({
    reportId: input.reportId,
    orgId: input.orgId,
    inputSources: [
      `forecast:${input.modelType}`,
      `data-points:${input.inputData.length}`,
      ...input.assumptions.map((a) => `assumption:${a}`),
    ],
    calculationVersion: `${FORECASTING_VERSION}:${input.modelType}`,
    outputValues,
  })

  return { data, proof }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function fillFlat(data: ForecastDataPoint[], periods: number): ForecastProjection[] {
  const lastValue = data.length > 0 ? data[data.length - 1].value : 0
  const lastPeriod = data.length > 0 ? data[data.length - 1].period : '2026-01'
  return Array.from({ length: periods }, (_, i) => ({
    period: nextPeriodLabel(lastPeriod, i + 1),
    forecast: lastValue,
    confidenceLow: lastValue,
    confidenceHigh: lastValue,
  }))
}

function nextPeriodLabel(lastPeriod: string, offset: number): string {
  // Support both "YYYY-MM" and "YYYY-QN" formats
  const monthMatch = lastPeriod.match(/^(\d{4})-(\d{2})$/)
  if (monthMatch) {
    const year = parseInt(monthMatch[1])
    const month = parseInt(monthMatch[2])
    const totalMonths = year * 12 + month - 1 + offset
    const newYear = Math.floor(totalMonths / 12)
    const newMonth = (totalMonths % 12) + 1
    return `${newYear}-${String(newMonth).padStart(2, '0')}`
  }

  const qtrMatch = lastPeriod.match(/^(\d{4})-Q(\d)$/)
  if (qtrMatch) {
    const year = parseInt(qtrMatch[1])
    const qtr = parseInt(qtrMatch[2])
    const totalQtrs = (year - 1) * 4 + (qtr - 1) + offset
    const newYear = Math.floor(totalQtrs / 4) + 1
    const newQtr = (totalQtrs % 4) + 1
    return `${newYear}-Q${newQtr}`
  }

  return `${lastPeriod}+${offset}`
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
