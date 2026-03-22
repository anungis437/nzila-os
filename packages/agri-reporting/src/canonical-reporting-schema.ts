// ---------------------------------------------------------------------------
// @nzila/agri-reporting — Canonical Reporting Schema
//
// ONE schema family for all Cora + Agrimo outputs.
// No per-app variations outside explicitly namespaced optional extensions.
// ---------------------------------------------------------------------------

import { z } from 'zod'

// ─── Schema version ───────────────────────────────────────────────────────

export const CANONICAL_SCHEMA_VERSION = '1.0.0' as const

// ─── Source app discriminator ─────────────────────────────────────────────

export const SourceApp = {
  CORA: 'cora',
  AGRIMO: 'agrimo',
} as const

export type SourceAppValue = (typeof SourceApp)[keyof typeof SourceApp]

// ─── Report scope types ───────────────────────────────────────────────────

export const EntityScope = {
  FARM: 'farm',
  COOPERATIVE: 'cooperative',
  REGION: 'region',
  NATIONAL: 'national',
} as const

export type EntityScopeValue = (typeof EntityScope)[keyof typeof EntityScope]

// ─── Canonical metric ─────────────────────────────────────────────────────

export const canonicalMetricSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  value: z.number(),
  unit: z.string().min(1),
  period: z.string().min(1),
})

export type CanonicalMetric = z.infer<typeof canonicalMetricSchema>

// ─── Canonical forecast summary ───────────────────────────────────────────

export const canonicalForecastSchema = z.object({
  forecast_type: z.string().min(1),
  target_period: z.string().min(1),
  predicted_value: z.number(),
  confidence_level: z.enum(['high', 'medium', 'low']),
  model_version: z.string().optional(),
})

export type CanonicalForecast = z.infer<typeof canonicalForecastSchema>

// ─── Risk signal ──────────────────────────────────────────────────────────

export const canonicalRiskSignalSchema = z.object({
  risk_type: z.string().min(1),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  description: z.string().min(1),
  affected_entity: z.string().optional(),
  mitigation: z.string().optional(),
})

export type CanonicalRiskSignal = z.infer<typeof canonicalRiskSignalSchema>

// ─── Supply chain event reference ─────────────────────────────────────────

export const canonicalSupplyChainEventSchema = z.object({
  chain_id: z.string().min(1),
  step_type: z.string().min(1),
  status: z.string().min(1),
  timestamp: z.string().datetime(),
  location: z.string().optional(),
  quantity_kg: z.number().nonnegative().optional(),
})

export type CanonicalSupplyChainEvent = z.infer<typeof canonicalSupplyChainEventSchema>

// ─── Provenance reference ─────────────────────────────────────────────────

export const canonicalProvenanceRefSchema = z.object({
  provenance_id: z.string().min(1),
  source_type: z.string().min(1),
  hash: z.string().min(1),
  verified: z.boolean(),
})

export type CanonicalProvenanceRef = z.infer<typeof canonicalProvenanceRefSchema>

// ─── App-specific extension blocks ────────────────────────────────────────
// Extensions allow app-specific data without polluting the shared schema.
// Each app gets its own namespaced block. No cross-contamination.

export const canonicalExtensionsSchema = z.object({
  cora: z.record(z.unknown()).optional(),
  agrimo: z.record(z.unknown()).optional(),
}).strict().optional()

export type CanonicalExtensions = z.infer<typeof canonicalExtensionsSchema>

// ─── Canonical Report — the ONE output schema ────────────────────────────

export const canonicalReportSchema = z.object({
  report_id: z.string().min(1),
  org_id: z.string().min(1),
  source_app: z.enum([SourceApp.CORA, SourceApp.AGRIMO]),
  schema_version: z.literal(CANONICAL_SCHEMA_VERSION),
  reporting_period: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
  entity_scope: z.enum([
    EntityScope.FARM,
    EntityScope.COOPERATIVE,
    EntityScope.REGION,
    EntityScope.NATIONAL,
  ]),
  report_type: z.string().min(1),
  title: z.string().min(1),
  generated_at: z.string().datetime(),

  // Core data sections
  metrics: z.array(canonicalMetricSchema).default([]),
  forecasts: z.array(canonicalForecastSchema).default([]),
  risk_signals: z.array(canonicalRiskSignalSchema).default([]),
  supply_chain_events: z.array(canonicalSupplyChainEventSchema).default([]),
  provenance_refs: z.array(canonicalProvenanceRefSchema).default([]),

  // Controlled extension point
  extensions: canonicalExtensionsSchema,
})

export type CanonicalReport = z.infer<typeof canonicalReportSchema>

// ─── Builder helper ───────────────────────────────────────────────────────

let canonicalSeq = 0

export interface BuildCanonicalReportParams {
  org_id: string
  source_app: SourceAppValue
  report_type: string
  title: string
  entity_scope: EntityScopeValue
  reporting_period: { start: string; end: string }
  metrics?: CanonicalMetric[]
  forecasts?: CanonicalForecast[]
  risk_signals?: CanonicalRiskSignal[]
  supply_chain_events?: CanonicalSupplyChainEvent[]
  provenance_refs?: CanonicalProvenanceRef[]
  extensions?: CanonicalExtensions
}

export function buildCanonicalReport(
  params: BuildCanonicalReportParams,
): CanonicalReport {
  canonicalSeq++
  return {
    report_id: `crpt_${Date.now().toString(36)}_${canonicalSeq.toString(36)}`,
    org_id: params.org_id,
    source_app: params.source_app,
    schema_version: CANONICAL_SCHEMA_VERSION,
    reporting_period: params.reporting_period,
    entity_scope: params.entity_scope,
    report_type: params.report_type,
    title: params.title,
    generated_at: new Date().toISOString(),
    metrics: params.metrics ?? [],
    forecasts: params.forecasts ?? [],
    risk_signals: params.risk_signals ?? [],
    supply_chain_events: params.supply_chain_events ?? [],
    provenance_refs: params.provenance_refs ?? [],
    extensions: params.extensions,
  }
}
