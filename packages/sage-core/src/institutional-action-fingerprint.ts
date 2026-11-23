// Durable payload fingerprint for institutional action idempotency.
// Replay must return the original transaction or CONFLICT — never a fabricated
// decision assembled from a mutated request sharing the same key.

import { createHash } from 'node:crypto'

export type InstitutionalActionFingerprintInput = {
  action: string
  mandateId: string
  resourceId: string
  /** Commitment increment for resource.commit; omit/null otherwise. */
  requestedCommitMinor?: number | null
  /** Opaque durable payload fields that define the transaction identity. */
  durablePayload: Record<string, unknown>
}

/** Canonical SHA-256 hex digest of the consequential request payload. */
export function institutionalActionPayloadFingerprint(
  input: InstitutionalActionFingerprintInput,
): string {
  const canonical = {
    action: input.action,
    mandateId: input.mandateId,
    resourceId: input.resourceId,
    requestedCommitMinor:
      input.requestedCommitMinor === undefined ? null : input.requestedCommitMinor,
    durablePayload: sortKeys(input.durablePayload),
  }
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(obj).sort()) {
      out[key] = sortKeys(obj[key])
    }
    return out
  }
  return value
}

export function readStoredPayloadFingerprint(safePayload: unknown): string | null {
  if (!safePayload || typeof safePayload !== 'object') return null
  const fingerprint = (safePayload as { payloadFingerprint?: unknown }).payloadFingerprint
  return typeof fingerprint === 'string' && fingerprint.length > 0 ? fingerprint : null
}
