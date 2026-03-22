// ---------------------------------------------------------------------------
// @nzila/agri-reporting — CoraGov Ingestion Contract
//
// Defines the wire-format for CoraGov ingestion payloads, the transformation
// pipeline from canonical reports → CoraGov table rows, and the
// IngestionResult envelope.
//
// Both Cora and Agrimo feed into CoraGov through exactly this contract.
// ---------------------------------------------------------------------------

import { z } from 'zod'
import { canonicalReportSchema, type CanonicalReport } from './canonical-reporting-schema.js'

// ─── CoraGov ingestion row ───────────────────────────────────────────────

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

// ─── CoraGov ingestion payload (batch of rows) ───────────────────────────

export const coraGovPayloadSchema = z.object({
  batch_id: z.string().min(1),
  submitted_at: z.string().datetime(),
  source_app: z.string().min(1),
  rows: z.array(coraGovRowSchema).min(1),
})

export type CoraGovPayload = z.infer<typeof coraGovPayloadSchema>

// ─── Ingestion result ─────────────────────────────────────────────────────

export interface IngestionOk {
  accepted: true
  batch_id: string
  row_count: number
}

export interface IngestionRejected {
  accepted: false
  batch_id: string
  reason: string
  errors?: { path: string; message: string }[]
}

export type IngestionResult = IngestionOk | IngestionRejected

// ─── Transform: CanonicalReport → CoraGovRow[] ───────────────────────────

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

// ─── Build ingestion payload from one or more canonical reports ───────────

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

  const rows = reports.flatMap(canonicalToCoraGovRows)
  if (rows.length === 0) {
    return {
      accepted: false,
      batch_id: '',
      reason: 'All reports have empty metrics — nothing to ingest',
    }
  }

  batchSeq++
  const batch_id = `cgov_${Date.now().toString(36)}_${batchSeq.toString(36)}`

  const payload: CoraGovPayload = {
    batch_id,
    submitted_at: new Date().toISOString(),
    source_app: sourceApp,
    rows,
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

  return { accepted: true, batch_id, row_count: rows.length }
}
