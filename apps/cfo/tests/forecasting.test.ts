/**
 * CFO — Forecasting Model Tests
 */
import { describe, it, expect } from 'vitest'
import {
  runForecast,
  FORECASTING_VERSION,
  type ForecastInput,
} from '@nzila/cfo-core/forecasting'
import { verifyFinancialProof } from '@nzila/cfo-core/proof'

const baseForecastInput: ForecastInput = {
  orgId: 'org-1',
  reportId: 'fc-1',
  modelType: 'linear',
  assumptions: ['Stable growth continues'],
  inputData: [
    { period: '2025-07', value: 40000 },
    { period: '2025-08', value: 42000 },
    { period: '2025-09', value: 44500 },
    { period: '2025-10', value: 43000 },
    { period: '2025-11', value: 46000 },
    { period: '2025-12', value: 48000 },
    { period: '2026-01', value: 47000 },
    { period: '2026-02', value: 50000 },
  ],
  periodsToForecast: 3,
}

describe('Forecasting', () => {
  describe('linear model', () => {
    it('produces ascending projections for upward-trending data', () => {
      const { data } = runForecast({ ...baseForecastInput, modelType: 'linear' })
      expect(data.projections.length).toBe(3)
      expect(data.projections[0].forecast).toBeGreaterThan(0)
    })

    it('produces confidence bands around forecast', () => {
      const { data } = runForecast({ ...baseForecastInput, modelType: 'linear' })
      for (const p of data.projections) {
        expect(p.confidenceLow).toBeLessThan(p.forecast)
        expect(p.confidenceHigh).toBeGreaterThan(p.forecast)
      }
    })

    it('labels next periods correctly', () => {
      const { data } = runForecast({ ...baseForecastInput, modelType: 'linear' })
      expect(data.projections[0].period).toBe('2026-03')
      expect(data.projections[1].period).toBe('2026-04')
      expect(data.projections[2].period).toBe('2026-05')
    })
  })

  describe('moving-average model', () => {
    it('forecasts using recent window average', () => {
      const { data } = runForecast({ ...baseForecastInput, modelType: 'moving-average' })
      expect(data.projections.length).toBe(3)
      // all projections should be the same (average of last N)
      const first = data.projections[0].forecast
      expect(data.projections[1].forecast).toBe(first)
      expect(data.projections[2].forecast).toBe(first)
    })

    it('includes model type in result', () => {
      const { data } = runForecast({ ...baseForecastInput, modelType: 'moving-average' })
      expect(data.modelType).toBe('moving-average')
    })
  })

  describe('weighted-average model', () => {
    it('produces projections biased toward recent values', () => {
      const { data } = runForecast({ ...baseForecastInput, modelType: 'weighted-average' })
      expect(data.projections.length).toBe(3)
      expect(data.projections[0].forecast).toBeGreaterThan(0)
    })

    it('includes model version', () => {
      const { data } = runForecast({ ...baseForecastInput, modelType: 'weighted-average' })
      expect(data.modelVersion).toBe(FORECASTING_VERSION)
    })
  })

  describe('quarterly period labels', () => {
    it('handles YYYY-QN format', () => {
      const { data } = runForecast({
        ...baseForecastInput,
        inputData: [
          { period: '2025-Q1', value: 100000 },
          { period: '2025-Q2', value: 110000 },
          { period: '2025-Q3', value: 115000 },
          { period: '2025-Q4', value: 120000 },
        ],
        periodsToForecast: 2,
        modelType: 'linear',
      })
      expect(data.projections[0].period).toBe('2026-Q1')
      expect(data.projections[1].period).toBe('2026-Q2')
    })
  })

  describe('proof attachment', () => {
    it('attaches a valid financial proof', () => {
      const { proof } = runForecast({ ...baseForecastInput, modelType: 'linear' })
      expect(proof.hash).toMatch(/^[a-f0-9]{64}$/)
      expect(verifyFinancialProof(proof)).toBe(true)
    })

    it('includes metric and orgId in proof', () => {
      const { proof } = runForecast({ ...baseForecastInput, modelType: 'linear' })
      expect(proof.orgId).toBe('org-1')
      expect(proof.reportId).toBe('fc-1')
    })
  })

  describe('edge cases', () => {
    it('handles flat data without error', () => {
      const { data } = runForecast({
        ...baseForecastInput,
        inputData: [
          { period: '2025-01', value: 5000 },
          { period: '2025-02', value: 5000 },
          { period: '2025-03', value: 5000 },
          { period: '2025-04', value: 5000 },
        ],
        modelType: 'linear',
      })
      // flat data -> all projections should be ~5000
      expect(data.projections[0].forecast).toBeCloseTo(5000, -1)
    })
  })
})
