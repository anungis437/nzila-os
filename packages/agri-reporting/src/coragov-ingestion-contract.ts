// ---------------------------------------------------------------------------
// @nzila/agri-reporting — CoraGov Ingestion Contract
//
// Defines the wire-format for CoraGov ingestion payloads, the transformation
// pipeline from canonical reports → CoraGov structured datasets, and the
// IngestionResult envelope.
//
// Both Cora and Agrimo feed into CoraGov through exactly this contract.
// All 5 canonical sections are ingested as structured datasets:
//   metrics, forecasts, risk_signals, supply_chain_events, provenance_refs
// ---------------------------------------------------------------------------

import { z } from 'zod'
import {
  canonicalReportSchema,
  canonicalMetricSchema,
  canonicalForecastSchema,
  canonicalRiskSignalSchema,
  canonicalSupplyChainEventSchema,
  canonicalProvenanceRefSchema,
  type CanonicalReport,
} from './canonical-reporting-schema.js'

// ─── CoraGov ingestion row (legacy — metrics only) ───────────────────────

export const coraGovRowSchema = z.object({
  org_id: z.string().min(1),
  source_app: z.string().min(1),
  report_id: z.string().min(1),
  report_type: z.string().min(1),
  period_start: z.string().datetime(),
  period_end: z.string().datetime(),
  entity_scope: z.string().min(1),
  metric_key: z.string().min(1),
  metric_label: z.string().min(1),
  metric_value: z.number(),
  metric_unit: z.string().min(1),
  metric_period: z.string().min(1),
  generated_at: z.string().datetime(),
  schema_version: z.string().min(1),
})

export type CoraGovRow = z.infer<typeof coraGovRowSchema>

// ─── CoraGov structured dataset ──────────────────────────────────────────
// Full canonical ingestion — all 5 sections preserved as typed arrays.

export const coraGovDatasetSchema = z.object({
  org_id: z.string().min(1),
  source_app: z.string().min(1),
  report_id: z.string().min(1),
  report_type: z.string().min(1),
  period_start: z.string().datetime(),
  period_end: z.string().datetime(),
  entity_scope: z.string().min(1),
  generated_at: z.string().datetime(),
  schema_version: z.string().min(1),
  metrics: z.array(canonicalMetricSchema),
  forecasts: z.array(canonicalForecastSchema),
  risk_signals: z.array(canonicalRiskSignalSchema),
  supply_chain_events: z.array(canonicalSupplyChainEventSchema),
  provenance_refs: z.array(canonicalProvenanceRefSchema),
})

export type CoraGovDataset = z.infer<typeof coraGovDatasetSchema>

// ─── CoraGov payload — structured (batch of datasets) ────────────────────

export const coraGovPayloadSchema = z.object({
  batch_id: z.string().min(1),
  submitted_at: z.string().datetime(),
  source_app: z.string().min(1),
  datasets: z.array(coraGovDatasetSchema).min(1),
})

export type CoraGovPayload = z.infer<typeof coraGovPayloadSchema>

// ─── Canonical section names ──────────────────────────────────────────────

export const CANONICAL_SECTIONS = [
  'metrics',
  'forecasts',
  'risk_signals',
  'supply_chain_events',
  'provenance_refs',
] as const

export type CanonicalSection = (typeof CANONICAL_SECTIONS)[number]

// ─── Ingestion result ─────────────────────────────────────────────────────

export interface IngestionOk {
  accepted: true
  batch_id: string
  dataset_count: number
  validated_sections: CanonicalSection[]
}

export interface IngestionRejected {
  accepted: false
  batch_id: string
  reason: string
  errors?: { section?: CanonicalSection; path: string; message: string }[]
}

export type IngestionResult = IngestionOk | IngestionRejected

// ─── Transform: CanonicalReport → CoraGovRow[] (legacy — metrics only) ───

export function canonicalToCoraGovRows(report: CanonicalReport): CoraGovRow[] {
  return report.metrics.map((m) => ({
    org_id: report.org_id,
    source_app: report.source_app,
    report_id: report.report_id,
    report_type: report.report_type,
    period_start: report.reporting_period.start,
    period_end: report.reporting_period.end,
    entity_scope: report.entity_scope,
    metric_key: m.key,
    metric_label: m.label,
    metric_value: m.value,
    metric_unit: m.unit,
    metric_period: m.period,
    generated_at: report.generated_at,
    schema_version: report.schema_version,
  }))
}

// ─── Transform: CanonicalReport → CoraGovDataset (full — all sections) ───

export function canonicalToCoraGovDataset(report: CanonicalReport): CoraGovDataset {
  return {
    org_id: report.org_id,
    source_app: report.source_app,
    report_id: report.report_id,
    report_type: report.report_type,
    period_start: report.reporting_period.start,
    period_end: report.reporting_period.end,
    entity_scope: report.entity_scope,
    generated_at: report.generated_at,
    schema_version: report.schema_version,
    metrics: report.metrics,
    forecasts: report.forecasts,
    risk_signals: report.risk_signals,
    supply_chain_events: report.supply_chain_events,
    provenance_refs: report.provenance_refs,
  }
}

// ─── Build structured ingestion payload from canonical reports ────────────

let batchSeq = 0

export function buildCoraGovPayload(
  sourceApp: string,
  reports: readonly CanonicalReport[],
): IngestionResult {
  if (reports.length === 0) {
    return {
      accepted: false,
      batch_id: '',
      reason: 'No reports provided',
    }
  }

  // Validate each report against the canonical schema first
  for (const report of reports) {
    const result = canonicalReportSchema.safeParse(report)
    if (!result.success) {
      return {
        accepted: false,
        batch_id: '',
        reason: `Report ${report.report_id} failed canonical validation`,
        errors: result.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      }
    }
  }

  const datasets = reports.map(canonicalToCoraGovDataset)

  batchSeq++
  const batch_id = `cgov_${Date.now().toString(36)}_${batchSeq.toString(36)}`

  const payload: CoraGovPayload = {
    batch_id,
    submitted_at: new Date().toISOString(),
    source_app: sourceApp,
    datasets,
  }

  // Validate the assembled payload
  const payloadResult = coraGovPayloadSchema.safeParse(payload)
  if (!payloadResult.success) {
    return {
      accepted: false,
      batch_id,
      reason: 'Assembled payload failed schema validation',
      errors: payloadResult.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    }
  }

  // Determine which sections have data
  const validated_sections = CANONICAL_SECTIONS.filter((s) =>
    datasets.some((d) => d[s].length > 0),
  )

  return { accepted: true, batch_id, dataset_count: datasets.length, validated_sections }
}
