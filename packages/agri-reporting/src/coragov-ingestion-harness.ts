// ---------------------------------------------------------------------------
// @nzila/agri-reporting — CoraGov Ingestion Harness
//
// In-process test harness that simulates CoraGov ingestion accept/reject
// without a real HTTP endpoint.  Validates each canonical section
// independently and returns per-section results.
// ---------------------------------------------------------------------------

import {
  coraGovPayloadSchema,
  coraGovDatasetSchema,
  CANONICAL_SECTIONS,
  type CoraGovPayload,
  type CanonicalSection,
  type IngestionResult,
} from './coragov-ingestion-contract.js'

/**
 * Simulate CoraGov ingestion endpoint.
 * Validates inbound payload against contract schema, validates each section
 * in every dataset independently, and returns structured result with
 * validated_sections and scoped errors.
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

  // Per-section validation across all datasets
  const sectionErrors: { section: CanonicalSection; path: string; message: string }[] = []
  const validatedSectionsSet = new Set<CanonicalSection>()

  for (let di = 0; di < payload.datasets.length; di++) {
    const ds = payload.datasets[di]
    const dsResult = coraGovDatasetSchema.safeParse(ds)
    if (!dsResult.success) {
      for (const issue of dsResult.error.issues) {
        const sectionMatch = CANONICAL_SECTIONS.find((s) =>
          issue.path[0] === s,
        )
        sectionErrors.push({
          section: sectionMatch ?? 'metrics',
          path: `datasets[${di}].${issue.path.join('.')}`,
          message: issue.message,
        })
      }
      continue
    }

    for (const section of CANONICAL_SECTIONS) {
      if (ds[section].length > 0) {
        validatedSectionsSet.add(section)
      }
    }
  }

  if (sectionErrors.length > 0) {
    return {
      accepted: false,
      batch_id: payload.batch_id,
      reason: 'Dataset section validation failed',
      errors: sectionErrors,
    }
  }

  return {
    accepted: true,
    batch_id: payload.batch_id,
    dataset_count: payload.datasets.length,
    validated_sections: [...validatedSectionsSet],
  }
}

/**
 * Build a raw payload object that can be passed to the harness. Useful when
 * you already have a validated CoraGovPayload and want to round-trip it.
 */
export function serializeForIngestion(payload: CoraGovPayload): unknown {
  return JSON.parse(JSON.stringify(payload))
}
