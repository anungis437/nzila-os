import { describe, it, expect } from 'vitest'
import {
  createRecommendation,
  createAlert,
  createInsight,
  assertExplainable,
} from '../src/explainability'

describe('createRecommendation', () => {
  it('builds a valid recommendation with explainability', () => {
    const rec = createRecommendation({
      type: 'yield_optimisation',
      title: 'Increase irrigation',
      priority: 'high',
      actionable: true,
      suggestedAction: 'Set drip irrigation to 5L/day',
      explanation: 'Soil moisture below threshold',
      sourceDataRefs: [{ type: 'sensor', id: 's1' }],
      confidenceLevel: 'HIGH',
      modelVersion: 'v1.0',
    })
    expect(rec.id).toMatch(/^rec_/)
    expect(rec.type).toBe('yield_optimisation')
    expect(rec.explanation).toBe('Soil moisture below threshold')
    expect(rec.confidenceLevel).toBe('HIGH')
    expect(rec.generatedAt).toBeTruthy()
  })
})

describe('createAlert', () => {
  it('builds a valid alert with explainability', () => {
    const alert = createAlert({
      type: 'pest_risk',
      severity: 'high',
      title: 'Locust activity detected',
      affectedEntities: ['field_1', 'field_2'],
      explanation: 'Satellite imagery shows swarm pattern',
      sourceDataRefs: [{ type: 'satellite', id: 'img_42' }],
      confidenceLevel: 'MEDIUM',
      modelVersion: 'v2.1',
    })
    expect(alert.id).toMatch(/^alert_/)
    expect(alert.severity).toBe('high')
    expect(alert.affectedEntities).toHaveLength(2)
  })
})

describe('createInsight', () => {
  it('builds a valid insight with explainability', () => {
    const insight = createInsight({
      type: 'yield_trend',
      title: 'Yield up 12% YoY',
      metricValue: 12,
      metricUnit: 'percent',
      comparisonPeriod: '2024 vs 2023',
      explanation: 'Better rainfall in Q2',
      sourceDataRefs: [{ type: 'harvest_data', id: 'h_2024' }],
      confidenceLevel: 'HIGH',
      modelVersion: 'v1.0',
    })
    expect(insight.id).toMatch(/^ins_/)
    expect(insight.metricValue).toBe(12)
    expect(insight.comparisonPeriod).toBe('2024 vs 2023')
  })
})

describe('assertExplainable', () => {
  it('passes for valid explainable output', () => {
    const rec = createRecommendation({
      type: 'x',
      title: 'y',
      priority: 'low',
      actionable: false,
      explanation: 'reason',
      sourceDataRefs: [{ type: 'a', id: 'b' }],
      confidenceLevel: 'LOW',
      modelVersion: 'v1',
    })
    expect(() => assertExplainable(rec)).not.toThrow()
  })

  it('throws INTELLIGENCE_CONTRACT_VIOLATION for missing explanation', () => {
    expect(() =>
      assertExplainable({
        explanation: '',
        sourceDataRefs: [{ type: 'a', id: 'b' }],
        confidenceLevel: 'HIGH',
        modelVersion: 'v1',
        generatedAt: new Date().toISOString(),
      }),
    ).toThrow('INTELLIGENCE_CONTRACT_VIOLATION')
  })

  it('throws for empty sourceDataRefs', () => {
    expect(() =>
      assertExplainable({
        explanation: 'ok',
        sourceDataRefs: [],
        confidenceLevel: 'HIGH',
        modelVersion: 'v1',
        generatedAt: new Date().toISOString(),
      }),
    ).toThrow('INTELLIGENCE_CONTRACT_VIOLATION')
  })

  it('throws for missing modelVersion', () => {
    expect(() =>
      assertExplainable({
        explanation: 'ok',
        sourceDataRefs: [{ type: 'a', id: 'b' }],
        confidenceLevel: 'HIGH',
        modelVersion: '',
        generatedAt: new Date().toISOString(),
      }),
    ).toThrow('INTELLIGENCE_CONTRACT_VIOLATION')
  })
})
