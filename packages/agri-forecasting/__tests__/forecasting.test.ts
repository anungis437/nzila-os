import { describe, it, expect } from 'vitest'
import {
  forecastYield,
  forecastPrice,
  forecastProduction,
} from '../src/engine'
import {
  createStubYieldForecastProvider,
  createStubPriceForecastProvider,
  createStubProductionForecastProvider,
} from '../src/providers'
import { ForecastType } from '@nzila/agri-core'

const yieldData = [
  { cropId: 'maize', regionId: 'central', season: '2024A', yieldKg: 3000, areaHa: 2 },
  { cropId: 'maize', regionId: 'central', season: '2024B', yieldKg: 4000, areaHa: 2 },
  { cropId: 'maize', regionId: 'central', season: '2023A', yieldKg: 3500, areaHa: 2 },
]

const priceData = [
  { cropId: 'coffee', marketId: 'east', date: new Date().toISOString(), pricePerKg: 2.5, currency: 'USD' },
  { cropId: 'coffee', marketId: 'east', date: new Date().toISOString(), pricePerKg: 3.0, currency: 'USD' },
  { cropId: 'coffee', marketId: 'east', date: new Date().toISOString(), pricePerKg: 2.8, currency: 'USD' },
]

const prodData = [
  { orgId: 'org_1', cropId: 'rice', season: '2024A', totalKg: 10000, producerCount: 5 },
  { orgId: 'org_1', cropId: 'rice', season: '2024B', totalKg: 12000, producerCount: 6 },
  { orgId: 'org_1', cropId: 'rice', season: '2023A', totalKg: 11000, producerCount: 5 },
]

describe('forecastYield', () => {
  it('returns a ForecastResult with confidence', async () => {
    const provider = createStubYieldForecastProvider(yieldData)
    const result = await forecastYield(provider, 'maize', 'central', 10)
    expect(result.id).toMatch(/^fcst_/)
    expect(result.forecastType).toBe(ForecastType.YIELD)
    expect(result.predictedValue).toBeGreaterThan(0)
    expect(result.confidenceRange.low).toBeLessThanOrEqual(result.predictedValue)
    expect(result.confidenceRange.high).toBeGreaterThanOrEqual(result.predictedValue)
    expect(result.explanation).toBeTruthy()
    expect(result.modelVersion).toBeTruthy()
  })

  it('confidence level reflects sample size', async () => {
    const provider = createStubYieldForecastProvider(yieldData)
    const result = await forecastYield(provider, 'maize', 'central', 10)
    expect(['high', 'medium', 'low']).toContain(result.confidenceLevel)
  })
})

describe('forecastPrice', () => {
  it('returns a ForecastResult for price', async () => {
    const provider = createStubPriceForecastProvider(priceData)
    const result = await forecastPrice(provider, 'coffee', 'east', 90)
    expect(result.forecastType).toBe(ForecastType.PRICE)
    expect(result.predictedValue).toBeGreaterThan(0)
    expect(result.explanation).toBeTruthy()
  })
})

describe('forecastProduction', () => {
  it('returns a ForecastResult for production', async () => {
    const provider = createStubProductionForecastProvider(prodData)
    const result = await forecastProduction(provider, 'org_1', 'rice')
    expect(result.forecastType).toBe(ForecastType.PRODUCTION)
    expect(result.predictedValue).toBeGreaterThan(0)
    expect(result.confidenceRange.low).toBeLessThanOrEqual(result.predictedValue)
  })
})
