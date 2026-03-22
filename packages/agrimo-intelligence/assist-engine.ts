/**
 * Agrimo — Assistive Intelligence Engine.
 *
 * Recommendations, alerts, insights. Every output includes:
 *   { explanation, source_data_refs, confidence_level }
 * Explainable AI — never a black box.
 */
import { z } from 'zod'

// ── Schemas ─────────────────────────────────────────────────────────────────

export const ConfidenceLevel = z.enum(['high', 'medium', 'low'])

export const SourceDataRefSchema = z.object({
  type: z.string(),
  id: z.string(),
  label: z.string().optional(),
})

export const RecommendationSchema = z.object({
  id: z.string(),
  type: z.enum([
    'planting_window',
    'harvest_timing',
    'quality_improvement',
    'logistics_route',
    'price_timing',
    'input_optimization',
    'risk_mitigation',
  ]),
  title: z.string(),
  explanation: z.string(),
  source_data_refs: z.array(SourceDataRefSchema),
  confidence_level: ConfidenceLevel,
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  actionable: z.boolean(),
  suggested_action: z.string().optional(),
  expires_at: z.string().datetime().optional(),
  created_at: z.string().datetime(),
})

export const AlertSchema = z.object({
  id: z.string(),
  type: z.enum([
    'weather_risk',
    'pest_detection',
    'quality_decline',
    'supply_chain_delay',
    'price_drop',
    'storage_capacity',
    'certification_expiry',
  ]),
  severity: z.enum(['critical', 'warning', 'info']),
  title: z.string(),
  explanation: z.string(),
  source_data_refs: z.array(SourceDataRefSchema),
  confidence_level: ConfidenceLevel,
  affected_entities: z.array(z.string()),
  created_at: z.string().datetime(),
  acknowledged: z.boolean().default(false),
})

export const InsightSchema = z.object({
  id: z.string(),
  type: z.enum([
    'yield_trend',
    'quality_pattern',
    'seasonal_pattern',
    'cooperative_benchmark',
    'market_opportunity',
  ]),
  title: z.string(),
  explanation: z.string(),
  source_data_refs: z.array(SourceDataRefSchema),
  confidence_level: ConfidenceLevel,
  metric_value: z.number().optional(),
  metric_unit: z.string().optional(),
  comparison_period: z.string().optional(),
  created_at: z.string().datetime(),
})

// ── Types ───────────────────────────────────────────────────────────────────

export type ConfidenceLevel_T = z.infer<typeof ConfidenceLevel>
export type SourceDataRef = z.infer<typeof SourceDataRefSchema>
export type Recommendation = z.infer<typeof RecommendationSchema>
export type Alert = z.infer<typeof AlertSchema>
export type Insight = z.infer<typeof InsightSchema>

// ── Engine ──────────────────────────────────────────────────────────────────

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** Generate a recommendation with full explainability. */
export function createRecommendation(params: {
  type: Recommendation['type']
  title: string
  explanation: string
  source_data_refs: SourceDataRef[]
  confidence_level: ConfidenceLevel_T
  priority: Recommendation['priority']
  suggested_action?: string
  expires_at?: string
}): Recommendation {
  return {
    id: makeId('rec'),
    type: params.type,
    title: params.title,
    explanation: params.explanation,
    source_data_refs: params.source_data_refs,
    confidence_level: params.confidence_level,
    priority: params.priority,
    actionable: !!params.suggested_action,
    suggested_action: params.suggested_action,
    expires_at: params.expires_at,
    created_at: new Date().toISOString(),
  }
}

/** Generate an alert with full explainability. */
export function createAlert(params: {
  type: Alert['type']
  severity: Alert['severity']
  title: string
  explanation: string
  source_data_refs: SourceDataRef[]
  confidence_level: ConfidenceLevel_T
  affected_entities: string[]
}): Alert {
  return {
    id: makeId('alert'),
    type: params.type,
    severity: params.severity,
    title: params.title,
    explanation: params.explanation,
    source_data_refs: params.source_data_refs,
    confidence_level: params.confidence_level,
    affected_entities: params.affected_entities,
    created_at: new Date().toISOString(),
    acknowledged: false,
  }
}

/** Generate an insight with full explainability. */
export function createInsight(params: {
  type: Insight['type']
  title: string
  explanation: string
  source_data_refs: SourceDataRef[]
  confidence_level: ConfidenceLevel_T
  metric_value?: number
  metric_unit?: string
  comparison_period?: string
}): Insight {
  return {
    id: makeId('insight'),
    type: params.type,
    title: params.title,
    explanation: params.explanation,
    source_data_refs: params.source_data_refs,
    confidence_level: params.confidence_level,
    metric_value: params.metric_value,
    metric_unit: params.metric_unit,
    comparison_period: params.comparison_period,
    created_at: new Date().toISOString(),
  }
}

/** Analyse crop batches and generate harvest timing recommendations. */
export function analyseHarvestTiming(batches: {
  id: string
  crop_type: string
  planted_at: string
  expected_harvest_at?: string
  status: string
}[]): Recommendation[] {
  const now = new Date()
  const recommendations: Recommendation[] = []

  for (const batch of batches) {
    if (batch.status !== 'growing' && batch.status !== 'ready') continue
    if (!batch.expected_harvest_at) continue

    const expectedDate = new Date(batch.expected_harvest_at)
    const daysUntilHarvest = Math.ceil(
      (expectedDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    )

    if (daysUntilHarvest <= 7 && daysUntilHarvest > 0) {
      recommendations.push(
        createRecommendation({
          type: 'harvest_timing',
          title: `${batch.crop_type} batch ready for harvest soon`,
          explanation: `Batch ${batch.id} of ${batch.crop_type} is expected to be ready for harvest in ${daysUntilHarvest} day(s). Consider preparing logistics and labour.`,
          source_data_refs: [
            { type: 'crop_batch', id: batch.id, label: batch.crop_type },
          ],
          confidence_level: daysUntilHarvest <= 3 ? 'high' : 'medium',
          priority: daysUntilHarvest <= 3 ? 'high' : 'medium',
          suggested_action: `Schedule harvest for batch ${batch.id} within ${daysUntilHarvest} day(s).`,
        }),
      )
    } else if (daysUntilHarvest <= 0) {
      recommendations.push(
        createRecommendation({
          type: 'harvest_timing',
          title: `${batch.crop_type} batch overdue for harvest`,
          explanation: `Batch ${batch.id} of ${batch.crop_type} was expected to be harvested ${Math.abs(daysUntilHarvest)} day(s) ago. Delayed harvest may affect quality.`,
          source_data_refs: [
            { type: 'crop_batch', id: batch.id, label: batch.crop_type },
          ],
          confidence_level: 'high',
          priority: 'critical',
          suggested_action: `Harvest batch ${batch.id} immediately to prevent quality loss.`,
        }),
      )
    }
  }

  return recommendations
}

/** Check storage capacity and generate alerts. */
export function checkStorageCapacity(collectionPoints: {
  id: string
  name: string
  capacity_kg: number
  current_stock_kg: number
}[]): Alert[] {
  const alerts: Alert[] = []

  for (const cp of collectionPoints) {
    const utilisation = cp.current_stock_kg / cp.capacity_kg

    if (utilisation >= 0.95) {
      alerts.push(
        createAlert({
          type: 'storage_capacity',
          severity: 'critical',
          title: `${cp.name} at capacity`,
          explanation: `Collection point ${cp.name} is at ${Math.round(utilisation * 100)}% capacity (${cp.current_stock_kg}/${cp.capacity_kg} kg). Incoming produce may need to be redirected.`,
          source_data_refs: [
            { type: 'collection_point', id: cp.id, label: cp.name },
          ],
          confidence_level: 'high',
          affected_entities: [cp.id],
        }),
      )
    } else if (utilisation >= 0.8) {
      alerts.push(
        createAlert({
          type: 'storage_capacity',
          severity: 'warning',
          title: `${cp.name} nearing capacity`,
          explanation: `Collection point ${cp.name} is at ${Math.round(utilisation * 100)}% capacity. Plan transport or arrange additional storage.`,
          source_data_refs: [
            { type: 'collection_point', id: cp.id, label: cp.name },
          ],
          confidence_level: 'high',
          affected_entities: [cp.id],
        }),
      )
    }
  }

  return alerts
}
