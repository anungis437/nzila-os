import { describe, it, expect } from 'vitest'
import {
  createRecommendation,
  createAlert,
  createInsight,
  analyseHarvestTiming,
  checkStorageCapacity,
} from '../assist-engine'

describe('Assist Engine', () => {
  describe('createRecommendation', () => {
    it('creates with explanation, confidence_level, source_data_refs', () => {
      const rec = createRecommendation({
        type: 'harvest_timing',
        title: 'Test recommendation',
        explanation: 'Because the crop is ready',
        source_data_refs: [{ type: 'batch', id: 'b1', label: 'Maize batch' }],
        confidence_level: 'high',
        priority: 'medium',
        suggested_action: 'Harvest now',
      })
      expect(rec.id).toMatch(/^rec_/)
      expect(rec.explanation).toBe('Because the crop is ready')
      expect(rec.confidence_level).toBe('high')
      expect(rec.source_data_refs).toHaveLength(1)
      expect(rec.actionable).toBe(true)
      expect(rec.suggested_action).toBe('Harvest now')
    })

    it('marks non-actionable when no suggested_action', () => {
      const rec = createRecommendation({
        type: 'quality_improvement',
        title: 'Info only',
        explanation: 'Observe trend',
        source_data_refs: [],
        confidence_level: 'low',
        priority: 'low',
      })
      expect(rec.actionable).toBe(false)
    })
  })

  describe('createAlert', () => {
    it('creates with required explainability fields', () => {
      const alert = createAlert({
        type: 'weather_risk',
        severity: 'warning',
        title: 'Heavy rain expected',
        explanation: 'Forecast shows 80mm in next 48h',
        source_data_refs: [{ type: 'weather', id: 'w1' }],
        confidence_level: 'medium',
        affected_entities: ['field1', 'field2'],
      })
      expect(alert.id).toMatch(/^alert_/)
      expect(alert.explanation).toBeTruthy()
      expect(alert.confidence_level).toBe('medium')
      expect(alert.acknowledged).toBe(false)
    })
  })

  describe('createInsight', () => {
    it('creates with metric info', () => {
      const insight = createInsight({
        type: 'yield_trend',
        title: 'Yield improving',
        explanation: 'Average yield up 15% vs last season',
        source_data_refs: [{ type: 'season', id: 's1' }],
        confidence_level: 'high',
        metric_value: 15,
        metric_unit: 'percent',
        comparison_period: 'vs_last_season',
      })
      expect(insight.id).toMatch(/^insight_/)
      expect(insight.metric_value).toBe(15)
      expect(insight.explanation).toBeTruthy()
    })
  })

  describe('analyseHarvestTiming', () => {
    it('flags batches ready within 7 days', () => {
      const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
      const recs = analyseHarvestTiming([
        {
          id: 'b1',
          crop_type: 'maize',
          planted_at: new Date().toISOString(),
          expected_harvest_at: soon,
          status: 'growing',
        },
      ])
      expect(recs).toHaveLength(1)
      expect(recs[0]!.type).toBe('harvest_timing')
      expect(recs[0]!.priority).toBe('high')
      expect(recs[0]!.confidence_level).toBe('high')
    })

    it('flags overdue batches as critical', () => {
      const past = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      const recs = analyseHarvestTiming([
        {
          id: 'b2',
          crop_type: 'cassava',
          planted_at: new Date().toISOString(),
          expected_harvest_at: past,
          status: 'growing',
        },
      ])
      expect(recs).toHaveLength(1)
      expect(recs[0]!.priority).toBe('critical')
    })

    it('ignores batches without expected_harvest_at', () => {
      const recs = analyseHarvestTiming([
        {
          id: 'b3',
          crop_type: 'beans',
          planted_at: new Date().toISOString(),
          status: 'growing',
        },
      ])
      expect(recs).toHaveLength(0)
    })

    it('ignores already harvested batches', () => {
      const recs = analyseHarvestTiming([
        {
          id: 'b4',
          crop_type: 'maize',
          planted_at: new Date().toISOString(),
          expected_harvest_at: new Date().toISOString(),
          status: 'harvested',
        },
      ])
      expect(recs).toHaveLength(0)
    })
  })

  describe('checkStorageCapacity', () => {
    it('alerts critical at >= 95%', () => {
      const alerts = checkStorageCapacity([
        { id: 'cp1', name: 'Hub A', capacity_kg: 1000, current_stock_kg: 960 },
      ])
      expect(alerts).toHaveLength(1)
      expect(alerts[0]!.severity).toBe('critical')
    })

    it('alerts warning at >= 80%', () => {
      const alerts = checkStorageCapacity([
        { id: 'cp2', name: 'Hub B', capacity_kg: 1000, current_stock_kg: 820 },
      ])
      expect(alerts).toHaveLength(1)
      expect(alerts[0]!.severity).toBe('warning')
    })

    it('no alert below 80%', () => {
      const alerts = checkStorageCapacity([
        { id: 'cp3', name: 'Hub C', capacity_kg: 1000, current_stock_kg: 500 },
      ])
      expect(alerts).toHaveLength(0)
    })
  })
})
