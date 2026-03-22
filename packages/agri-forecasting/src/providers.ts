// ---------------------------------------------------------------------------
// @nzila/agri-forecasting — Provider interfaces
// ---------------------------------------------------------------------------
// Abstract data providers for forecast models. V1 ships with deterministic
// stubs; V2+ can swap in ML model backends.
// ---------------------------------------------------------------------------

import type { GeoPoint } from '@nzila/agri-core'

/** Historical yield observation for a crop in a region/season */
export interface YieldObservation {
  readonly cropId: string
  readonly regionId: string
  readonly season: string
  readonly yieldKg: number
  readonly areaHa: number
}

/** Historical price observation from a market source */
export interface PriceObservation {
  readonly cropId: string
  readonly marketId: string
  readonly date: string
  readonly pricePerKg: number
  readonly currency: string
}

/** Climate data point for a region */
export interface ClimateDataPoint {
  readonly regionId: string
  readonly date: string
  readonly temperatureC: number
  readonly rainfallMm: number
  readonly humidityPercent: number
}

/** Production record for aggregation-based forecasts */
export interface ProductionRecord {
  readonly orgId: string
  readonly cropId: string
  readonly season: string
  readonly totalKg: number
  readonly producerCount: number
}

// ---------------------------------------------------------------------------
// Provider contracts
// ---------------------------------------------------------------------------

export interface YieldForecastProvider {
  getHistoricalYields(cropId: string, regionId: string, seasons: number): Promise<YieldObservation[]>
}

export interface PriceForecastProvider {
  getHistoricalPrices(cropId: string, marketId: string, days: number): Promise<PriceObservation[]>
}

export interface ClimateForecastProvider {
  getClimateData(regionId: string, location: GeoPoint, days: number): Promise<ClimateDataPoint[]>
}

export interface ProductionForecastProvider {
  getHistoricalProduction(orgId: string, cropId: string, seasons: number): Promise<ProductionRecord[]>
}

// ---------------------------------------------------------------------------
// Deterministic stubs (V1)
// ---------------------------------------------------------------------------

export function createStubYieldForecastProvider(data: YieldObservation[]): YieldForecastProvider {
  return {
    async getHistoricalYields(cropId, regionId, seasons) {
      return data
        .filter((d) => d.cropId === cropId && d.regionId === regionId)
        .slice(0, seasons)
    },
  }
}

export function createStubPriceForecastProvider(data: PriceObservation[]): PriceForecastProvider {
  return {
    async getHistoricalPrices(cropId, marketId, days) {
      const cutoff = Date.now() - days * 86_400_000
      return data.filter(
        (d) => d.cropId === cropId && d.marketId === marketId && new Date(d.date).getTime() >= cutoff,
      )
    },
  }
}

export function createStubClimateForecastProvider(data: ClimateDataPoint[]): ClimateForecastProvider {
  return {
    async getClimateData(regionId) {
      return data.filter((d) => d.regionId === regionId)
    },
  }
}

export function createStubProductionForecastProvider(data: ProductionRecord[]): ProductionForecastProvider {
  return {
    async getHistoricalProduction(orgId, cropId, seasons) {
      return data
        .filter((d) => d.orgId === orgId && d.cropId === cropId)
        .slice(0, seasons)
    },
  }
}
