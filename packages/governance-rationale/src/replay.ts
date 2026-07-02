import { createHash } from 'node:crypto'
import type {
  GovernanceRationale,
  RationaleReplayResult,
} from './schema'

// ─── Canonical Payload ────────────────────────────────────────────────────────

/**
 * Produces the deterministic canonical representation of a governance rationale
 * for hash computation. Fields are sorted alphabetically to ensure replay safety.
 */
export function buildCanonicalPayload(rationale: GovernanceRationale): Record<string, unknown> {
  return {
    id: rationale.id,
    orgId: rationale.orgId,
    decisionTitle: rationale.decisionTitle,
    decisionType: rationale.decisionType,
    trigger: rationale.trigger,
    context: rationale.context,
    deviation: rationale.deviation,
    outcome: rationale.outcome,
    rationale: rationale.rationale,
    supportingEvidenceRefs: [...rationale.supportingEvidenceRefs].sort(),
    policyRef: rationale.policyRef,
    decisionAnalysisRef: rationale.decisionAnalysisRef,
    releaseRef: rationale.releaseRef,
    status: rationale.status,
    ownerId: rationale.ownerId,
    createdAt: rationale.createdAt,
  }
}

// ─── Hash Computation ─────────────────────────────────────────────────────────

/**
 * Compute SHA-256 hash of the canonical governance rationale payload.
 */
export function computeRationaleHash(rationale: GovernanceRationale): string {
  const payload = buildCanonicalPayload(rationale)
  const json = JSON.stringify(payload, Object.keys(payload).sort())
  return createHash('sha256').update(json).digest('hex')
}

// ─── Replay Verification ──────────────────────────────────────────────────────

/**
 * Replay a governance rationale record, verifying its integrity.
 * Returns a replay result indicating whether the stored hash matches recomputation.
 */
export function replayRationale(rationale: GovernanceRationale): RationaleReplayResult {
  const computedHash = computeRationaleHash(rationale)
  const storedHash = rationale.replayHash
  const hashMismatch = storedHash !== null && storedHash !== computedHash
  const integrityVerified = storedHash !== null && !hashMismatch

  return {
    rationaleId: rationale.id,
    replayedAt: new Date().toISOString(),
    integrityVerified,
    computedHash,
    storedHash,
    hashMismatch,
    rationaleSnapshot: rationale,
  }
}
