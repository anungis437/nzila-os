/**
 * @nzila/platform-cognition-core/consent — Consent gate
 *
 * Wraps a producer (memory recall, preference profile, state inference, or
 * trajectory risk score) in a consent check that:
 *
 *   1. Verifies the policy covers the requested zones and memory kinds.
 *   2. Intersects with the jurisdiction profile (more restrictive wins).
 *   3. Applies retention cutoff.
 *   4. Strips events whose tags overlap the effective exclusion set.
 *   5. Returns a structured ConsentGateResult with redaction flag and reasons
 *      that are safe to surface in audit logs (no PII).
 *
 * The gate is *fail-closed*: unknown unhandled exception in the producer is
 * surfaced as `allowed: false` with a generic reason, never as an unhandled
 * promise rejection.
 *
 * @module @nzila/platform-cognition-core/consent/gate
 */
import { daysBetween } from '../utils'
import { effectiveExcludedTags, jurisdictionProfile } from './jurisdiction'
import { policyCovers } from './policies'
import type {
  ConsentGateResult,
  ConsentPolicy,
  ConsentZone,
  MemoryKind,
  RecalledMemory,
} from '../types'

export interface GateRequest {
  readonly policy: ConsentPolicy
  readonly requiredZones: readonly ConsentZone[]
  readonly requiredKinds: readonly MemoryKind[]
  /** Reference time for retention cutoff. Defaults to now. */
  readonly now?: string
}

interface PreflightOk {
  readonly ok: true
  readonly excludedTags: readonly string[]
  readonly retentionDays: number
  readonly cutoffISO: string
  readonly reasons: readonly string[]
}

interface PreflightDenied {
  readonly ok: false
  readonly reasons: readonly string[]
}

type Preflight = PreflightOk | PreflightDenied

/**
 * Runs the policy/jurisdiction/retention check without any producer call.
 * Returns either a denial (with reasons) or the effective restrictions to
 * apply when filtering produced records.
 */
export function preflightConsent(req: GateRequest): Preflight {
  const reasons: string[] = []
  const profile = jurisdictionProfile(req.policy.jurisdiction)

  // Coverage
  const coverage = policyCovers(req.policy, {
    zones: req.requiredZones,
    kinds: req.requiredKinds,
  })
  if (!coverage.covered) {
    if (coverage.missingZones.length > 0) {
      reasons.push(`zones not consented: ${coverage.missingZones.join(',')}`)
    }
    if (coverage.missingKinds.length > 0) {
      reasons.push(`memory kinds not consented: ${coverage.missingKinds.join(',')}`)
    }
  }

  // Jurisdiction-denied zones/kinds
  const denyZ = profile.defaultDeniedZones.filter((z) => req.requiredZones.includes(z))
  const denyK = profile.defaultDeniedKinds.filter((k) => req.requiredKinds.includes(k))
  if (denyZ.length > 0) reasons.push(`jurisdiction denies zones: ${denyZ.join(',')}`)
  if (denyK.length > 0) reasons.push(`jurisdiction denies kinds: ${denyK.join(',')}`)

  if (reasons.length > 0) return { ok: false, reasons }

  const retentionDays = Math.min(req.policy.retentionDays, profile.maxRetentionDays)
  const now = req.now ?? new Date().toISOString()
  const cutoffMs = new Date(now).getTime() - retentionDays * 86_400_000
  const cutoffISO = new Date(cutoffMs).toISOString()
  const excludedTags = effectiveExcludedTags(req.policy.excludedTags, profile)

  return {
    ok: true,
    excludedTags,
    retentionDays,
    cutoffISO,
    reasons: [
      `retention=${retentionDays}d`,
      excludedTags.length > 0 ? `excludedTags=${excludedTags.length}` : 'excludedTags=0',
    ],
  }
}

/** Filter recalled memories against retention + excluded tags. */
export function applyMemoryFilters(
  memories: readonly RecalledMemory[],
  pf: PreflightOk,
): { kept: RecalledMemory[]; redacted: boolean } {
  const excludedSet = new Set(pf.excludedTags.map((t) => t.toLowerCase()))
  const kept: RecalledMemory[] = []
  let redacted = false
  for (const m of memories) {
    if (m.event.occurredAt < pf.cutoffISO) {
      redacted = true
      continue
    }
    const tagsLower = m.event.tags.map((t) => t.toLowerCase())
    if (tagsLower.some((t) => excludedSet.has(t))) {
      redacted = true
      continue
    }
    kept.push(m)
  }
  return { kept, redacted }
}

/**
 * Generic gate. Use this for non-memory producers (state, trajectory).
 *
 * The producer is invoked only when preflight passes. Producer errors are
 * caught and converted to `allowed: false` so the gate is fail-closed.
 */
export async function gateAsync<T>(
  req: GateRequest,
  producer: (pf: PreflightOk) => T | Promise<T>,
): Promise<ConsentGateResult<T>> {
  const pf = preflightConsent(req)
  if (!pf.ok) {
    return { allowed: false, value: null, reasons: pf.reasons, redacted: false }
  }
  try {
    const value = await producer(pf)
    return { allowed: true, value, reasons: pf.reasons, redacted: false }
  } catch (err) {
    return {
      allowed: false,
      value: null,
      reasons: [`producer error: ${err instanceof Error ? err.message : 'unknown'}`],
      redacted: false,
    }
  }
}

/** Synchronous variant for memory recall, where producers are sync. */
export function gate<T>(
  req: GateRequest,
  producer: (pf: PreflightOk) => T,
): ConsentGateResult<T> {
  const pf = preflightConsent(req)
  if (!pf.ok) {
    return { allowed: false, value: null, reasons: pf.reasons, redacted: false }
  }
  try {
    const value = producer(pf)
    return { allowed: true, value, reasons: pf.reasons, redacted: false }
  } catch (err) {
    return {
      allowed: false,
      value: null,
      reasons: [`producer error: ${err instanceof Error ? err.message : 'unknown'}`],
      redacted: false,
    }
  }
}

/**
 * Recall + gate in one call. The most common consumer entry point.
 *
 * Note: recall accepts `daysBetween`-aware filters; we do not double-filter,
 * but we DO post-filter for retention because recall uses occurredAt, while
 * retention is computed against the gate's `now` clock.
 */
export function gatedRecall(
  req: GateRequest & { recall: () => RecalledMemory[] },
): ConsentGateResult<RecalledMemory[]> {
  const pf = preflightConsent(req)
  if (!pf.ok) {
    return { allowed: false, value: null, reasons: pf.reasons, redacted: false }
  }
  const raw = req.recall()
  const { kept, redacted } = applyMemoryFilters(raw, pf)
  return { allowed: true, value: kept, reasons: pf.reasons, redacted }
}

/** Tiny helper exported for tests/audit; returns days between two ISO strings. */
export const _daysBetween = daysBetween
