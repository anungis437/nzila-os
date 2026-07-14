// ─── @nzila/sage-core — Phase 8B records-lifecycle pure logic ────────────────
// Pure, side-effect-free evaluation of persisted retention/hold/tombstone
// controls. It NEVER destroys anything and makes no policy judgments — it only
// reports whether the persisted controls currently permit destruction.

import { sha256Hex } from './export-scope'
import type {
  SageExportDestructionEligibility,
  SageDestructionEligibilityCode,
  SageExportLegalHold,
  SageExportRetentionAssignment,
} from './records-types'
import type { SagePackageAvailabilityStatus } from './records-types'

/** Deterministic hash of a private storage reference — the raw locator is never persisted in evidence/audit. */
export function hashSageStorageReference(storageReference: string): string {
  return sha256Hex(`sage-storage-reference:${storageReference}`)
}

/** Stable hold code so duplicate placement attempts are detectable per package. */
export function sageLegalHoldCode(input: { exportPackageId: string; nonce: string }): string {
  return `sage-hold:${input.exportPackageId}:${input.nonce}`
}

/**
 * Canonical digest of the ACTIVE legal-hold set for a package. Binds an approval
 * to the exact set of active holds (by id), so adding OR releasing a hold after
 * approval — not just changing the count — invalidates the approval on recompute.
 */
export function computeActiveHoldSetDigest(holds: readonly SageExportLegalHold[]): string {
  const activeIds = holds
    .filter((h) => h.status === 'active')
    .map((h) => h.id)
    .sort()
  return sha256Hex(`sage-active-holds:${activeIds.join(',')}`)
}

export type SageDestructionEligibilityInput = {
  availabilityStatus: SagePackageAvailabilityStatus
  retention: SageExportRetentionAssignment | undefined
  legalHolds: readonly SageExportLegalHold[]
  now: Date
  /**
   * Whether the package's committed content/manifest hashes still match the
   * caller's recomputed values. Undefined means "not evaluated here" and is
   * treated as matching (integrity is separately enforced at execution time).
   */
  integrityMatches?: boolean
}

/**
 * Evaluate whether a package is currently eligible for destruction against its
 * PERSISTED controls. Default posture is RETAIN: a package with no retention
 * assignment is never eligible.
 */
export function evaluateSageExportDestructionEligibility(
  input: SageDestructionEligibilityInput,
): SageExportDestructionEligibility {
  const reasonCodes: SageDestructionEligibilityCode[] = []
  const activeHolds = input.legalHolds.filter((h) => h.status === 'active')
  const activeHoldCount = activeHolds.length
  const retainUntil = input.retention?.retainUntil ?? null

  if (input.availabilityStatus === 'destroyed') {
    reasonCodes.push('PACKAGE_ALREADY_DESTROYED')
  }
  if (input.integrityMatches === false) {
    reasonCodes.push('PACKAGE_INTEGRITY_MISMATCH')
  }
  if (!input.retention) {
    reasonCodes.push('RETENTION_NOT_ASSIGNED')
  } else if (Date.parse(input.retention.retainUntil) > input.now.getTime()) {
    reasonCodes.push('RETENTION_NOT_ELAPSED')
  }
  if (activeHoldCount > 0) {
    reasonCodes.push('ACTIVE_LEGAL_HOLD')
  }

  const eligible = reasonCodes.length === 0
  if (eligible) reasonCodes.push('ELIGIBLE')

  return { eligible, reasonCodes, retainUntil, activeHoldCount }
}

/**
 * Compute retain_until once from the approved basis AND freeze the authoritative
 * provenance of the basis event. Event-date basis requires a caller-supplied,
 * validated event source; the other bases derive from package lifecycle records.
 */
export function computeSageRetainUntil(input: {
  retentionBasis: 'created_at' | 'delivered_at' | 'event_date'
  retentionDurationDays: number
  exportPackageId: string
  packageGeneratedAt: string
  firstDeliveredAt?: string | null
  firstDeliveredReceiptId?: string | null
  eventDate?: string | null
  eventSourceId?: string | null
}): {
  retentionStartedAt: string
  retainUntil: string
  retentionBasisSourceId: string
  retentionBasisSourceTimestamp: string
} {
  let startMs: number
  let sourceId: string
  if (input.retentionBasis === 'created_at') {
    startMs = Date.parse(input.packageGeneratedAt)
    // created_at basis is anchored to the immutable package identity + timestamp.
    sourceId = input.exportPackageId
  } else if (input.retentionBasis === 'delivered_at') {
    if (!input.firstDeliveredAt || !input.firstDeliveredReceiptId) {
      throw new Error('delivered_at retention basis requires the authoritative receipt id and timestamp')
    }
    startMs = Date.parse(input.firstDeliveredAt)
    sourceId = input.firstDeliveredReceiptId
  } else {
    if (!input.eventDate || !input.eventSourceId) {
      throw new Error('event_date retention basis requires a validated event source id and date')
    }
    startMs = Date.parse(input.eventDate)
    sourceId = input.eventSourceId
  }
  if (!Number.isFinite(startMs)) throw new Error('invalid retention start timestamp')
  const startedAt = new Date(startMs).toISOString()
  const retainUntil = new Date(startMs + input.retentionDurationDays * 86_400_000).toISOString()
  return {
    retentionStartedAt: startedAt,
    retainUntil,
    retentionBasisSourceId: sourceId,
    retentionBasisSourceTimestamp: startedAt,
  }
}
