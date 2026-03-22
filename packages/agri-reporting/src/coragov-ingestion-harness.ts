// ---------------------------------------------------------------------------
// @nzila/agri-reporting — CoraGov Ingestion Harness
//
// In-process test harness that simulates CoraGov ingestion accept/reject
// without a real HTTP endpoint.  Uses only the contract types + Zod.
// ---------------------------------------------------------------------------

import {
  coraGovPayloadSchema,
  type CoraGovPayload,
  type IngestionResult,
} from './coragov-ingestion-contract.js'

/**
 * Simulate CoraGov ingestion endpoint.
 * Validates inbound payload against contract schema, returns structured result.
 */
export function simulateCoraGovIngestion(
  rawPayload: unknown,
): IngestionResult {
  const result = coraGovPayloadSchema.safeParse(rawPayload)

  if (!result.success) {
    return {
      accepted: false,
      batch_id: typeof rawPayload === 'object' && rawPayload !== null
        ? (rawPayload as Record<string, unknown>).batch_id as string ?? ''
        : '',
      reason: 'Payload validation failed',
      errors: result.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    }
  }

  const payload = result.data

  return {
    accepted: true,
    batch_id: payload.batch_id,
    row_count: payload.rows.length,
  }
}

/**
 * Build a raw payload object that can be passed to the harness. Useful when
 * you already have a validated CoraGovPayload and want to round-trip it.
 */
export function serializeForIngestion(payload: CoraGovPayload): unknown {
  return JSON.parse(JSON.stringify(payload))
}
