// ---------------------------------------------------------------------------
// @nzila/agri-forecasting — Forecast engine
// ---------------------------------------------------------------------------
// Deterministic V1 forecast computations producing ForecastResult outputs
// that satisfy the explainability contract from @nzila/agri-core.
// ---------------------------------------------------------------------------

import type { ForecastResult, ConfidenceLevel } from '@nzila/agri-core'
import { ForecastType, ConfidenceLevel as CL } from '@nzila/agri-core'
import type {
  YieldForecastProvider,
  PriceForecastProvider,
  ProductionForecastProvider,
} from './providers'

let idCounter = 0

function makeId(): string {
  idCounter++
  return `fcst_${Date.now().toString(36)}_${idCounter.toString(36)}`
}

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}

function stddev(values: number[], avg: number): number {
  if (values.length < 2) return 0
  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

function confidenceFromSampleSize(n: number): ConfidenceLevel {
  if (n >= 5) return CL.HIGH
  if (n >= 3) return CL.MEDIUM
  return CL.LOW
}

/**
 * Forecast yield for a crop/region based on historical means.
 */
export async function forecastYield(
  provider: YieldForecastProvider,
  cropId: string,
  regionId: string,
  areaHa: number,
  seasons: number = 5,
): Promise<ForecastResult> {
  const data = await provider.getHistoricalYields(cropId, regionId, seasons)
  const perHa = data.map((d) => (d.areaHa > 0 ? d.yieldKg / d.areaHa : 0))
  const avg = mean(perHa)
  const sd = stddev(perHa, avg)
  const predicted = avg * areaHa
  const confidence = confidenceFromSampleSize(data.length)

  return {
    id: makeId(),
    forecastType: ForecastType.YIELD,
    cropId,
    regionId,
    season: null,
    predictedValue: predicted,
    confidenceRange: { low: (avg - sd) * areaHa, high: (avg + sd) * areaHa },
    assumptions: [`Historical mean yield per ha: ${avg.toFixed(2)}`, `Sample size: ${data.length} seasons`],
    inputRefs: data.map((d) => `yield:${d.cropId}:${d.regionId}:${d.season}`),
    explanation: `Yield forecast based on ${data.length}-season historical mean of ${avg.toFixed(2)} kg/ha applied to ${areaHa} ha.`,
    sourceDataRefs: data.map((d) => ({ type: 'yield_observation', id: `${d.cropId}:${d.season}`, label: `${d.season} yield` })),
    confidenceLevel: confidence,
    modelVersion: '1.0-deterministic',
    generatedAt: new Date().toISOString(),
  }
}

/**
 * Forecast price trend for a crop/market based on historical prices.
 */
export async function forecastPrice(
  provider: PriceForecastProvider,
  cropId: string,
  marketId: string,
  lookbackDays: number = 90,
): Promise<ForecastResult> {
  const data = await provider.getHistoricalPrices(cropId, marketId, lookbackDays)
  const prices = data.map((d) => d.pricePerKg)
  const avg = mean(prices)
  const sd = stddev(prices, avg)
  const confidence = confidenceFromSampleSize(data.length)

  return {
    id: makeId(),
    forecastType: ForecastType.PRICE,
    cropId,
    regionId: marketId,
    season: null,
    predictedValue: avg,
    confidenceRange: { low: avg - sd, high: avg + sd },
    assumptions: [`${data.length} price observations over ${lookbackDays} days`, `Mean: ${avg.toFixed(4)}/kg`],
    inputRefs: data.map((d) => `price:${d.cropId}:${d.marketId}:${d.date}`),
    explanation: `Price forecast based on ${data.length}-observation mean of ${avg.toFixed(4)}/kg from ${marketId}.`,
    sourceDataRefs: data.map((d) => ({ type: 'price_observation', id: `${d.cropId}:${d.date}`, label: `${d.date} price` })),
    confidenceLevel: confidence,
    modelVersion: '1.0-deterministic',
    generatedAt: new Date().toISOString(),
  }
}

/**
 * Forecast production aggregate for a cooperative/org.
 */
export async function forecastProduction(
  provider: ProductionForecastProvider,
  orgId: string,
  cropId: string,
  seasons: number = 5,
): Promise<ForecastResult> {
  const data = await provider.getHistoricalProduction(orgId, cropId, seasons)
  const totals = data.map((d) => d.totalKg)
  const avg = mean(totals)
  const sd = stddev(totals, avg)
  const confidence = confidenceFromSampleSize(data.length)

  return {
    id: makeId(),
    forecastType: ForecastType.PRODUCTION,
    cropId,
    regionId: null,
    season: null,
    predictedValue: avg,
    confidenceRange: { low: avg - sd, high: avg + sd },
    assumptions: [`${data.length} seasons of production data`, `Mean: ${avg.toFixed(2)} kg`],
    inputRefs: data.map((d) => `production:${d.orgId}:${d.cropId}:${d.season}`),
    explanation: `Production forecast based on ${data.length}-season historical mean of ${avg.toFixed(2)} kg.`,
    sourceDataRefs: data.map((d) => ({ type: 'production_record', id: `${d.orgId}:${d.season}`, label: `${d.season} production` })),
    confidenceLevel: confidence,
    modelVersion: '1.0-deterministic',
    generatedAt: new Date().toISOString(),
  }
}
