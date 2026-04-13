import { describe, it, expect } from 'vitest'
import {
  forecastYield,
  forecastPrice,
  forecastProduction,
} from '../src/engine'
import {
  createStubClimateForecastProvider,
  createStubYieldForecastProvider,
  createStubPriceForecastProvider,
  createStubProductionForecastProvider,
} from '../src/providers'
import { ForecastType } from '@nzila/agri-core'
import * as forecasting from '../src/index'

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

  it('handles zero-area observations and low sample sizes', async () => {
    const provider = createStubYieldForecastProvider([
      { cropId: 'maize', regionId: 'central', season: '2025A', yieldKg: 2000, areaHa: 0 },
    ])

    const result = await forecastYield(provider, 'maize', 'central', 8, 1)

    expect(result.predictedValue).toBe(0)
    expect(result.confidenceRange).toEqual({ low: 0, high: 0 })
    expect(result.confidenceLevel).toBe('low')
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

  it('filters out stale price observations outside the lookback window', async () => {
    const provider = createStubPriceForecastProvider([
      { cropId: 'coffee', marketId: 'east', date: new Date().toISOString(), pricePerKg: 2.7, currency: 'USD' },
      {
        cropId: 'coffee',
        marketId: 'east',
        date: new Date(Date.now() - 5 * 86_400_000).toISOString(),
        pricePerKg: 99,
        currency: 'USD',
      },
    ])

    const result = await forecastPrice(provider, 'coffee', 'east', 2)

    expect(result.predictedValue).toBeCloseTo(2.7)
    expect(result.inputRefs).toHaveLength(1)
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

describe('providers and barrel exports', () => {
  it('limits yield and production history to the requested season count', async () => {
    const yieldProvider = createStubYieldForecastProvider(yieldData)
    const productionProvider = createStubProductionForecastProvider(prodData)

    const yields = await yieldProvider.getHistoricalYields('maize', 'central', 2)
    const production = await productionProvider.getHistoricalProduction('org_1', 'rice', 2)

    expect(yields).toHaveLength(2)
    expect(production).toHaveLength(2)
  })

  it('filters climate data by region and exposes barrel exports', async () => {
    const provider = createStubClimateForecastProvider([
      { regionId: 'central', date: '2026-01-01', temperatureC: 24, rainfallMm: 10, humidityPercent: 60 },
      { regionId: 'west', date: '2026-01-01', temperatureC: 20, rainfallMm: 5, humidityPercent: 55 },
    ])

    const climate = await provider.getClimateData('central', { lat: 0, lng: 0 }, 7)

    expect(climate).toHaveLength(1)
    expect(climate[0].regionId).toBe('central')
    expect(forecasting.forecastYield).toBe(forecastYield)
    expect(typeof forecasting.createStubClimateForecastProvider).toBe('function')
  })
})
