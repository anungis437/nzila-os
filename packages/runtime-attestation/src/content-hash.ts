/**
 * @nzila/runtime-attestation — Content hashing
 * @module @nzila/runtime-attestation/content-hash
 */
import { createHash } from 'node:crypto'

/**
 * Compute a deterministic content hash for a JSON-serializable payload.
 * Object keys are sorted recursively before serialization to ensure
 * stable hashes regardless of key ordering.
 */
export function computeContentHash(payload: unknown): string {
  const canonical = canonicalize(payload)
  const json = JSON.stringify(canonical)
  const digest = createHash('sha256').update(json).digest('hex')
  return `sha256-${digest}`
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(canonicalize)
  const entries = Object.entries(value as Record<string, unknown>)
    .map(([k, v]) => [k, canonicalize(v)] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return Object.fromEntries(entries)
}
