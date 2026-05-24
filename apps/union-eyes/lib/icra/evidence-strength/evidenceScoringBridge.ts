/**
 * Evidence-Strength → Scoring bridge.
 *
 * Doctrine: declared continuity is not evidenced continuity. The
 * evidence-strength taxonomy (NONE..CROSS_VALIDATED) is the canonical
 * surface for that distinction. This bridge exposes a pure multiplier
 * function that scoring code can apply to a raw answer contribution
 * once evidence level is captured per-answer.
 *
 * STATUS: PURE HELPER — NOT YET LIVE.
 *
 * Wiring `applyEvidenceMultiplier()` into `scoreAssessment()` requires
 * extending the `Answer` type with an optional `evidenceLevel` field,
 * which touches:
 *   - the question-pool runtime,
 *   - fixtures and seed packages,
 *   - persistence (answer rows),
 *   - scoring trace audit fingerprint.
 *
 * That is deferred to v1.3.0 (Answer-type extension wave). Until then
 * this helper is callable and unit-tested but is intentionally NOT
 * invoked from the live scoring path. When the wave lands, scoring
 * gains a single call site:
 *
 *     const contribution = applyEvidenceMultiplier(
 *       effectiveScore * weight,
 *       answer.evidenceLevel,
 *     );
 *
 * The undefined-passthrough behaviour means the wiring is backward-
 * compatible by construction: existing answers without an
 * `evidenceLevel` are scored exactly as today.
 */
import { evidenceContribution, type EvidenceLevel } from './evidenceTaxonomy';

/**
 * Multiplier curve in [0, 1] applied to a raw contribution based on
 * the answer's evidence level.
 *
 * Calibration (deliberately conservative — favours under-claiming over
 * over-claiming, in line with doctrine "honesty over inflation"):
 *
 *   NONE             → 0.50   (no evidence — claim discounted by half)
 *   VERBAL           → 0.60
 *   DOCUMENTED       → 0.70
 *   OPERATIONAL      → 0.80
 *   VERIFIED         → 0.90
 *   CROSS_VALIDATED  → 1.00   (independent audit — full credit)
 *
 * Formula: `evidenceContribution(level) * 0.5 + 0.5`, which is monotone
 * in `EVIDENCE_LEVEL_ORDER` and crosses unity only at the top of the
 * ladder. The 0.5 floor on NONE prevents a single unsupported answer
 * from collapsing a dimension to zero while still applying a measurable
 * drag.
 */
export function evidenceMultiplier(level: EvidenceLevel): number {
  return evidenceContribution(level) * 0.5 + 0.5;
}

/**
 * Apply the evidence multiplier to a raw scoring contribution.
 *
 * When `level` is undefined, returns the contribution unchanged
 * (backward-compat passthrough; required for the staged rollout
 * described in the file header).
 */
export function applyEvidenceMultiplier(
  contribution: number,
  level: EvidenceLevel | undefined,
): number {
  if (level === undefined) return contribution;
  return contribution * evidenceMultiplier(level);
}
