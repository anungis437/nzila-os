/**
 * Agrimo — Data Provenance.
 *
 * Every data point carries its origin: source, raw input, transformations,
 * hash, timestamp. Hash computed locally, deterministic.
 * Throws AGRIMO_DATA_BLOCKED_NO_PROVENANCE if provenance is missing.
 */
import { createHash } from 'crypto'
import { z } from 'zod'

// ── Schemas ─────────────────────────────────────────────────────────────────

export const TransformationSchema = z.object({
  step: z.string(),
  description: z.string(),
  applied_at: z.string().datetime(),
  applied_by: z.string(),
})

export const ProvenanceSchema = z.object({
  id: z.string(),
  source: z.string(),
  source_type: z.enum([
    'manual_entry',
    'sensor',
    'import',
    'api',
    'derived',
    'external',
  ]),
  raw_input: z.unknown(),
  transformations: z.array(TransformationSchema).default([]),
  hash: z.string(),
  timestamp: z.string().datetime(),
  device_id: z.string().optional(),
  verified: z.boolean().default(false),
})

// ── Types ───────────────────────────────────────────────────────────────────

export type Transformation = z.infer<typeof TransformationSchema>
export type Provenance = z.infer<typeof ProvenanceSchema>

export interface ProvenanceAttached<T> {
  data: T
  provenance: Provenance
}

// ── Core Functions ──────────────────────────────────────────────────────────

/** Compute a deterministic hash for any data payload. */
export function computeHash(data: unknown): string {
  const serialised = JSON.stringify(data, Object.keys(data as Record<string, unknown>).sort())
  return createHash('sha256').update(serialised).digest('hex')
}

/** Create provenance metadata for a piece of data. */
export function createProvenance(params: {
  source: string
  source_type: Provenance['source_type']
  raw_input: unknown
  device_id?: string
}): Provenance {
  const now = new Date().toISOString()
  const hash = computeHash(params.raw_input)
  return {
    id: `prov_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    source: params.source,
    source_type: params.source_type,
    raw_input: params.raw_input,
    transformations: [],
    hash,
    timestamp: now,
    device_id: params.device_id,
    verified: false,
  }
}

/** Attach provenance to a data record. */
export function attachProvenance<T>(
  data: T,
  provenance: Provenance,
): ProvenanceAttached<T> {
  return { data, provenance }
}

/** Record a transformation to existing provenance. Recomputes hash. */
export function recordTransformation(
  provenance: Provenance,
  transformedData: unknown,
  step: string,
  description: string,
  appliedBy: string,
): Provenance {
  const now = new Date().toISOString()
  const transformation: Transformation = {
    step,
    description,
    applied_at: now,
    applied_by: appliedBy,
  }
  return {
    ...provenance,
    transformations: [...provenance.transformations, transformation],
    hash: computeHash(transformedData),
  }
}

/** Verify that a data payload matches its provenance hash. */
export function verifyProvenance(
  data: unknown,
  provenance: Provenance,
): boolean {
  const currentHash = computeHash(data)
  return currentHash === provenance.hash
}

/**
 * Enforce provenance — throws if provenance is missing or invalid.
 * This is the gate: no data enters the system without provenance.
 */
export function enforceProvenance<T>(
  record: ProvenanceAttached<T> | { data: T; provenance?: undefined },
): ProvenanceAttached<T> {
  if (!record.provenance) {
    throw new Error('AGRIMO_DATA_BLOCKED_NO_PROVENANCE')
  }

  // Validate provenance schema
  const result = ProvenanceSchema.safeParse(record.provenance)
  if (!result.success) {
    throw new Error(
      `AGRIMO_DATA_BLOCKED_INVALID_PROVENANCE: ${result.error.message}`,
    )
  }

  return record as ProvenanceAttached<T>
}

/** Build a provenance chain summary for audit trail. */
export function getProvenanceChain(provenance: Provenance): {
  source: string
  source_type: string
  transformations_count: number
  first_recorded: string
  last_modified: string
  hash: string
  verified: boolean
} {
  const lastTransformation =
    provenance.transformations[provenance.transformations.length - 1]
  return {
    source: provenance.source,
    source_type: provenance.source_type,
    transformations_count: provenance.transformations.length,
    first_recorded: provenance.timestamp,
    last_modified: lastTransformation?.applied_at ?? provenance.timestamp,
    hash: provenance.hash,
    verified: provenance.verified,
  }
}
