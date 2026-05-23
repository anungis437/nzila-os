/**
 * Contradiction → Continuity Confidence bridge.
 *
 * Doctrine: contradictions REDUCE confidence — never average.
 * This module wires the v2 contradiction-detection engine into the v1
 * continuity confidence aggregation surface in a strictly ADDITIVE,
 * non-mutating way.
 *
 * Input shapes are taken AS-IS from the existing engines; this bridge
 * does not change `aggregateConfidenceByDomain()` or
 * `detectContradictions()` signatures. It only re-projects v2 dimension
 * penalties onto v1 confidence domains and subtracts them — preserving
 * nulls (no fabricated neutrals).
 */
import type { ContinuityConfidenceDomain } from '../continuityConfidenceSignals';

/**
 * v2 contradiction dimension keys (mirror of
 * `contradictionSignalPairs.reducesConfidenceIn` union).
 */
export type ContradictionDimensionKey =
  | 'institutional_continuity'
  | 'governance_fragility'
  | 'trust_debt'
  | 'operational_memory'
  | 'transition_readiness';

/**
 * Canonical mapping from v2 contradiction dimensions to v1 continuity
 * confidence domains. A single v2 dimension may map to multiple v1
 * domains when the institutional concept spans both surfaces; in that
 * case the penalty is distributed across all targets (not summed onto
 * each — see `applyContradictionPenaltiesToConfidence`).
 *
 * Mapping rationale (doctrine):
 *   - institutional_continuity → operational clarity is the surface
 *     where continuity of practice is felt.
 *   - governance_fragility → governance confidence directly.
 *   - operational_memory → both reconstruction and recoverability
 *     confidence, since memory loss erodes the ability to rebuild AND
 *     to recover.
 *   - transition_readiness → onboarding confidence.
 *   - trust_debt → has no direct v1 domain; it bleeds across
 *     governance and operational clarity (broad, low-intensity).
 */
export const V2_DIMENSION_TO_V1_DOMAIN: Readonly<
  Record<ContradictionDimensionKey, ReadonlyArray<ContinuityConfidenceDomain>>
> = {
  institutional_continuity: ['operational_clarity'],
  governance_fragility: ['governance_confidence'],
  operational_memory: ['reconstruction_confidence', 'recoverability_confidence'],
  transition_readiness: ['onboarding_confidence'],
  trust_debt: ['governance_confidence', 'operational_clarity'],
};

/**
 * Apply contradiction-engine per-dimension penalties to an aggregated
 * confidence map. Pure / non-mutating.
 *
 * Semantics:
 *   - Null domain values stay null (refusal-preserving).
 *   - Penalties from multiple v2 dimensions targeting the same v1
 *     domain are summed, then clamped to 0.7 (the same clamp used by
 *     `detectContradictions()` per-dimension cap) to prevent runaway
 *     compounding.
 *   - When a v2 dimension maps to N v1 domains, the full penalty is
 *     applied to EACH target domain (no division). This is intentional:
 *     a contradiction that erodes operational memory plausibly erodes
 *     both reconstruction and recoverability with equal weight — they
 *     are different facets of the same institutional capability.
 *   - Final confidence is clamped to [0, 1].
 *
 * @param aggregated Output of `aggregateConfidenceByDomain()`.
 * @param perDimensionPenalty Output of `detectContradictions()`'s
 *        `perDimensionConfidencePenalty`.
 * @param mapping Override mapping (test seam). Defaults to canonical.
 */
export function applyContradictionPenaltiesToConfidence(
  aggregated: Readonly<Record<ContinuityConfidenceDomain, number | null>>,
  perDimensionPenalty: Readonly<Record<string, number>>,
  mapping: Readonly<
    Record<ContradictionDimensionKey, ReadonlyArray<ContinuityConfidenceDomain>>
  > = V2_DIMENSION_TO_V1_DOMAIN,
): Record<ContinuityConfidenceDomain, number | null> {
  // Accumulate per-v1-domain penalties.
  const domainPenalty: Record<ContinuityConfidenceDomain, number> = {
    operational_clarity: 0,
    governance_confidence: 0,
    reconstruction_confidence: 0,
    onboarding_confidence: 0,
    modernization_continuity_confidence: 0,
    recoverability_confidence: 0,
  };
  for (const [v2Dim, penalty] of Object.entries(perDimensionPenalty)) {
    if (penalty <= 0) continue;
    const targets = mapping[v2Dim as ContradictionDimensionKey];
    if (!targets) continue;
    for (const dom of targets) {
      domainPenalty[dom] = Math.min(0.7, domainPenalty[dom] + penalty);
    }
  }

  const out: Record<ContinuityConfidenceDomain, number | null> = {
    operational_clarity: aggregated.operational_clarity,
    governance_confidence: aggregated.governance_confidence,
    reconstruction_confidence: aggregated.reconstruction_confidence,
    onboarding_confidence: aggregated.onboarding_confidence,
    modernization_continuity_confidence: aggregated.modernization_continuity_confidence,
    recoverability_confidence: aggregated.recoverability_confidence,
  };
  for (const key of Object.keys(out) as ContinuityConfidenceDomain[]) {
    const current = out[key];
    if (current === null) continue; // refusal-preserving
    const penalty = domainPenalty[key];
    if (penalty <= 0) continue;
    out[key] = Math.max(0, Math.min(1, current - penalty));
  }
  return out;
}
