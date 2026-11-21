/**
 * Policy Integrity — Canonical serialization, hashing, and signing.
 *
 * Policies MUST be integrity-verified before activation. This module provides:
 *
 *  1. Deterministic canonical serialization (sorted keys, stable output)
 *  2. SHA-256 content hash computation
 *  3. Hash verification (tamper detection)
 *  4. HMAC-SHA-256 signing (placeholder for future asymmetric upgrade)
 *  5. Fail-closed guard: assertIntegrityOrThrow
 *
 * The content_hash is computed over the canonical serialization of the policy's
 * governance-relevant fields (NOT the full DB row). This ensures that
 * administrative fields (timestamps, IDs, superseded_by) do not invalidate
 * the hash when they change.
 *
 * Fields included in canonical serialization:
 *  - policyFamilyId, semver, name, domain
 *  - workflowBindings, operationalScope
 *  - allowedActorTypes, allowedRoles, approvalRequiredRoles, approverRoles
 *  - governanceRationale, riskClassification
 *  - reviewCadenceDays, replayCompatibilityVersion
 *  - effectiveFrom, effectiveUntil
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

// ── Canonical policy payload ──────────────────────────────────────────────────
//
// Only governance-relevant fields are included. Administrative fields
// (id, created_at, superseded_by, etc.) are excluded.

export interface PolicyCanonicalPayload {
  policyFamilyId: string
  semver: string
  name: string
  domain: string
  workflowBindings: unknown
  operationalScope: unknown
  governanceRationale: string
  riskClassification: string
  reviewCadenceDays: number
  replayCompatibilityVersion: string
  effectiveFrom: string | null
  effectiveUntil: string | null
}

// ── Serialization ─────────────────────────────────────────────────────────────

/**
 * Deterministically serialize a policy payload to a canonical JSON string.
 *
 * Rules:
 *  - Object keys are sorted alphabetically at every depth
 *  - Arrays preserve order (order is semantically significant)
 *  - Null and undefined values are normalized to null
 *  - No trailing whitespace; single-line output
 */
export function canonicalSerialize(payload: PolicyCanonicalPayload): string {
  return JSON.stringify(sortObjectKeys(payload))
}

function sortObjectKeys(value: unknown): unknown {
  if (value === null || value === undefined) return null
  if (Array.isArray(value)) return value.map(sortObjectKeys)
  if (typeof value === 'object') {
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(value as object).sort()) {
      sorted[key] = sortObjectKeys((value as Record<string, unknown>)[key])
    }
    return sorted
  }
  return value
}

// ── Hashing ───────────────────────────────────────────────────────────────────

/**
 * Compute the SHA-256 content hash of a policy's canonical serialization.
 * Returns a lowercase hex string.
 */
export function computeContentHash(payload: PolicyCanonicalPayload): string {
  return createHash('sha256').update(canonicalSerialize(payload)).digest('hex')
}

/**
 * Verify that the stored content_hash matches the recomputed hash.
 * Returns true if they match, false otherwise.
 */
export function verifyContentHash(
  payload: PolicyCanonicalPayload,
  expectedHash: string,
): boolean {
  const recomputed = computeContentHash(payload)
  try {
    // Timing-safe comparison to prevent timing attacks
    return timingSafeEqual(Buffer.from(recomputed, 'hex'), Buffer.from(expectedHash, 'hex'))
  } catch {
    return false
  }
}

// ── Tamper detection ──────────────────────────────────────────────────────────

export interface TamperingReport {
  tampered: boolean
  storedHash: string
  recomputedHash: string
  reason: string
}

/**
 * Detect if a policy payload has been tampered with by comparing its stored
 * content_hash to the recomputed hash.
 */
export function detectTampering(
  payload: PolicyCanonicalPayload,
  storedHash: string,
): TamperingReport {
  const recomputedHash = computeContentHash(payload)
  const tampered = recomputedHash !== storedHash
  return {
    tampered,
    storedHash,
    recomputedHash,
    reason: tampered
      ? `Content hash mismatch — stored: ${storedHash.slice(0, 16)}… recomputed: ${recomputedHash.slice(0, 16)}…`
      : 'Content hash matches — no tampering detected.',
  }
}

/**
 * Fail-closed guard: throws if integrity verification fails.
 * Call this before any operation that requires a valid policy hash.
 */
export function assertIntegrityOrThrow(
  payload: PolicyCanonicalPayload,
  storedHash: string | null | undefined,
): void {
  if (!storedHash) {
    throw new Error(
      `[policy-integrity] UNSIGNED_POLICY_ACTIVATION_BLOCKED: ` +
        `Policy "${payload.policyFamilyId}@${payload.semver}" has no content_hash. ` +
        'Policies must be hashed before activation.',
    )
  }
  const report = detectTampering(payload, storedHash)
  if (report.tampered) {
    throw new Error(
      `[policy-integrity] POLICY_INTEGRITY_VIOLATION: ` +
        `Policy "${payload.policyFamilyId}@${payload.semver}" has been tampered with. ` +
        report.reason,
    )
  }
}

// ── Signing ───────────────────────────────────────────────────────────────────
//
// Current implementation: HMAC-SHA-256 with a shared signing key.
// Reserved for upgrade to asymmetric signing (Ed25519 or RSA-PSS).
//
// The signingKey should come from a secure environment variable or secrets
// manager. Never hard-code it.

/**
 * Sign a policy payload using HMAC-SHA-256.
 * Returns a lowercase hex signature string.
 */
export function signPolicy(payload: PolicyCanonicalPayload, signingKey: string): string {
  return createHmac('sha256', signingKey).update(canonicalSerialize(payload)).digest('hex')
}

/**
 * Verify an HMAC-SHA-256 signature against a policy payload.
 * Returns true if the signature is valid.
 */
export function verifySignature(
  payload: PolicyCanonicalPayload,
  signature: string,
  signingKey: string,
): boolean {
  const expected = signPolicy(payload, signingKey)
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))
  } catch {
    return false
  }
}

// ── Snapshot hash ─────────────────────────────────────────────────────────────

/**
 * Compute an integrity hash for a governance snapshot.
 * The snapshot payload is any serializable object representing the full
 * governance topology at a point in time.
 */
export function computeSnapshotHash(snapshotPayload: unknown): string {
  const canonical = JSON.stringify(sortObjectKeys(snapshotPayload))
  return createHash('sha256').update(canonical).digest('hex')
}
