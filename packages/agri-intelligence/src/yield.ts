// ---------------------------------------------------------------------------
// Yield intelligence — deterministic V1 models
// ---------------------------------------------------------------------------

import type {
  ClimateRiskFactor,
  ClimateRiskProvider,
  YieldDataPoint,
  YieldModelProvider,
} from './providers'
import type { GeoPoint } from '@nzila/agri-core'

/** Yield efficiency = (actual yield / expected yield) × 100 */
export interface YieldEfficiencyResult {
  cropId: string
  regionId: string
  actualKg: number
  expectedKg: number
  efficiencyPercent: number
}

/** Expected yield = mean of historical yields per hectare × area */
export interface ExpectedYieldResult {
  cropId: string
  regionId: string
  areaHa: number
  expectedKg: number
  historicalMean: number
  sampleSize: number
}

export interface YieldTrendForecast {
  cropId: string
  regionId: string
  forecastYieldPerHa: number
  slopePerSeason: number
  intercept: number
  r2: number
  sampleSize: number
}

export interface ClimateAdjustedYieldResult extends ExpectedYieldResult {
  climateRiskScore: number
  riskAdjustmentPercent: number
  adjustedExpectedKg: number
}

// ---------------------------------------------------------------------------
// Pure computations (no I/O)
// ---------------------------------------------------------------------------

/**
 * Compute the mean yield per hectare from data points.
 * Returns 0 if no data.
 */
export function computeHistoricalMeanYieldPerHa(data: YieldDataPoint[]): number {
  if (data.length === 0) return 0
  const total = data.reduce((sum, d) => sum + (d.areaHa > 0 ? d.yieldKg / d.areaHa : 0), 0)
  return total / data.length
}

function extractYieldPerHa(data: YieldDataPoint[]): number[] {
  return data
    .filter((point) => point.areaHa > 0)
    .map((point) => point.yieldKg / point.areaHa)
}

/**
 * Simple OLS regression on historical yield/ha by season index.
 * Returns a one-step-ahead forecast and fit metrics.
 */
export function forecastYieldPerHaTrend(
  cropId: string,
  regionId: string,
  data: YieldDataPoint[],
): YieldTrendForecast {
  const series = extractYieldPerHa(data)
  if (series.length < 2) {
    return {
      cropId,
      regionId,
      forecastYieldPerHa: series[0] ?? 0,
      slopePerSeason: 0,
      intercept: series[0] ?? 0,
      r2: 0,
      sampleSize: series.length,
    }
  }

  const n = series.length
  const x = Array.from({ length: n }, (_, i) => i + 1)
  const meanX = x.reduce((sum, v) => sum + v, 0) / n
  const meanY = series.reduce((sum, v) => sum + v, 0) / n

  let numerator = 0
  let denominator = 0
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX
    numerator += dx * (series[i] - meanY)
    denominator += dx * dx
  }

  const slope = denominator === 0 ? 0 : numerator / denominator
  const intercept = meanY - slope * meanX
  const forecast = intercept + slope * (n + 1)

  const ssTot = series.reduce((sum, y) => sum + (y - meanY) ** 2, 0)
  const ssRes = series.reduce((sum, y, i) => {
    const predicted = intercept + slope * x[i]
    return sum + (y - predicted) ** 2
  }, 0)
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot

  return {
    cropId,
    regionId,
    forecastYieldPerHa: Math.max(0, forecast),
    slopePerSeason: slope,
    intercept,
    r2: Number.isFinite(r2) ? Math.max(0, Math.min(1, r2)) : 0,
    sampleSize: n,
  }
}

/**
 * Climate-adjustment multiplier based on weighted expected impact.
 */
export function computeClimateRiskAdjustment(
  factors: readonly ClimateRiskFactor[],
): { climateRiskScore: number; riskAdjustmentPercent: number } {
  if (factors.length === 0) {
    return { climateRiskScore: 0, riskAdjustmentPercent: 0 }
  }

  // Weighted expected impact: sum(probability * impactPercent)
  const expectedImpact = factors.reduce(
    (sum, factor) => sum + factor.probability * factor.impactPercent,
    0,
  )
  const climateRiskScore = Math.max(0, Math.min(1, expectedImpact / 100))
  return {
    climateRiskScore,
    // Cap climate penalty to protect against outlier inputs.
    riskAdjustmentPercent: Math.max(0, Math.min(35, expectedImpact)),
  }
}

/** Compute expected yield for a given area from a historical mean */
export function computeExpectedYield(
  cropId: string,
  regionId: string,
  areaHa: number,
  data: YieldDataPoint[],
): ExpectedYieldResult {
  const mean = computeHistoricalMeanYieldPerHa(data)
  return {
    cropId,
    regionId,
    areaHa,
    expectedKg: mean * areaHa,
    historicalMean: mean,
    sampleSize: data.length,
  }
}

/**
 * Blend historical mean and regression trend for stronger generalisation.
 */
export function computeExpectedYieldWithTrend(
  cropId: string,
  regionId: string,
  areaHa: number,
  data: YieldDataPoint[],
): ExpectedYieldResult {
  const mean = computeHistoricalMeanYieldPerHa(data)
  const trend = forecastYieldPerHaTrend(cropId, regionId, data)

  // Weight trend by fit quality and sample support, fallback to mean.
  const trendWeight = Math.max(0, Math.min(0.7, trend.r2 * 0.7))
  const blendedPerHa = mean * (1 - trendWeight) + trend.forecastYieldPerHa * trendWeight

  return {
    cropId,
    regionId,
    areaHa,
    expectedKg: blendedPerHa * areaHa,
    historicalMean: mean,
    sampleSize: data.length,
  }
}

export function applyClimateAdjustment(
  expected: ExpectedYieldResult,
  factors: readonly ClimateRiskFactor[],
): ClimateAdjustedYieldResult {
  const { climateRiskScore, riskAdjustmentPercent } = computeClimateRiskAdjustment(factors)
  const adjustedExpectedKg = expected.expectedKg * (1 - riskAdjustmentPercent / 100)

  return {
    ...expected,
    climateRiskScore,
    riskAdjustmentPercent,
    adjustedExpectedKg: Math.max(0, adjustedExpectedKg),
  }
}

/** Compute yield efficiency = (actual / expected) × 100 */
export function computeYieldEfficiency(
  cropId: string,
  regionId: string,
  actualKg: number,
  expectedKg: number,
): YieldEfficiencyResult {
  return {
    cropId,
    regionId,
    actualKg,
    expectedKg,
    efficiencyPercent: expectedKg > 0 ? (actualKg / expectedKg) * 100 : 0,
  }
}

// ---------------------------------------------------------------------------
// Provider-backed functions
// ---------------------------------------------------------------------------

export async function getExpectedYield(
  provider: YieldModelProvider,
  cropId: string,
  regionId: string,
  areaHa: number,
  seasons: number = 5,
): Promise<ExpectedYieldResult> {
  const data = await provider.getHistoricalYields(cropId, regionId, seasons)
  // Keep legacy behavior stable for existing consumers/tests.
  return computeExpectedYield(cropId, regionId, areaHa, data)
}

export async function getExpectedYieldWithClimateAdjustment(params: {
  provider: YieldModelProvider
  climateProvider: ClimateRiskProvider
  cropId: string
  regionId: string
  areaHa: number
  location: GeoPoint
  seasons?: number
}): Promise<ClimateAdjustedYieldResult> {
  const seasons = params.seasons ?? 8
  const data = await params.provider.getHistoricalYields(
    params.cropId,
    params.regionId,
    seasons,
  )
  const base = computeExpectedYieldWithTrend(
    params.cropId,
    params.regionId,
    params.areaHa,
    data,
  )
  const factors = await params.climateProvider.getRiskFactors(params.regionId, params.location)
  return applyClimateAdjustment(base, factors)
}
