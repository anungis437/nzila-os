// ---------------------------------------------------------------------------
// @nzila/agri-provenance — Deterministic hash utilities
// ---------------------------------------------------------------------------

import { createHash } from 'node:crypto'
import type { ProvenanceRecord, ProvenanceTransformation } from '@nzila/agri-core'
import { ProvenanceSourceType } from '@nzila/agri-core'

let idCounter = 0

function makeId(prefix: string): string {
  idCounter++
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`
}

/**
 * Compute a deterministic SHA-256 hash for any data payload.
 * Keys are sorted for determinism.
 */
export function computeHash(data: unknown): string {
  const normalised =
    typeof data === 'object' && data !== null && !Array.isArray(data)
      ? JSON.stringify(data, Object.keys(data as Record<string, unknown>).sort())
      : JSON.stringify(data)
  return createHash('sha256').update(normalised).digest('hex')
}

/**
 * Create a provenance record for a piece of data.
 * Captures source, source type, and computes the output hash.
 */
export function createProvenanceRecord(params: {
  orgId: string
  source: string
  sourceType: (typeof ProvenanceSourceType)[keyof typeof ProvenanceSourceType]
  rawInputRef?: string
  deviceId?: string
  outputData: unknown
  transformationVersion?: string
}): ProvenanceRecord {
  const hash = computeHash(params.outputData)
  return {
    id: makeId('prov'),
    orgId: params.orgId,
    sourceType: params.sourceType,
    source: params.source,
    rawInputRef: params.rawInputRef ?? null,
    transformations: [],
    transformationVersion: params.transformationVersion ?? '1.0',
    outputHash: hash,
    deviceId: params.deviceId ?? null,
    verified: false,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Record a transformation step, recomputing the hash from new data.
 * Returns a new ProvenanceRecord (immutable).
 */
export function recordTransformation(
  provenance: ProvenanceRecord,
  transformedData: unknown,
  step: string,
  description: string,
  appliedBy: string,
): ProvenanceRecord {
  const transformation: ProvenanceTransformation = {
    step,
    description,
    appliedAt: new Date().toISOString(),
    appliedBy,
  }
  return {
    ...provenance,
    transformations: [...provenance.transformations, transformation],
    outputHash: computeHash(transformedData),
  }
}

/**
 * Verify that a provenance hash matches the expected output data.
 */
export function verifyProvenance(provenance: ProvenanceRecord, outputData: unknown): boolean {
  return computeHash(outputData) === provenance.outputHash
}

/**
 * Attach provenance to a data record. Returns { data, provenance }.
 */
export function attachProvenance<T>(
  data: T,
  provenance: ProvenanceRecord,
): { data: T; provenance: ProvenanceRecord } {
  return { data, provenance }
}

/**
 * Gate: throw if provenance is missing or unverified.
 * Use at system boundaries to enforce data integrity.
 */
export function enforceProvenance(
  provenance: ProvenanceRecord | null | undefined,
  outputData: unknown,
): void {
  if (!provenance) {
    throw new Error('AGRI_DATA_BLOCKED_NO_PROVENANCE: provenance record is required')
  }
  if (!verifyProvenance(provenance, outputData)) {
    throw new Error('AGRI_DATA_BLOCKED_HASH_MISMATCH: provenance hash does not match output data')
  }
}
