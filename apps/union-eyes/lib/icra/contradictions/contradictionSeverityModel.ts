/**
 * Contradiction Severity Model — pure function. Maps raw pair severity to
 * a confidence penalty applied by the confidence engine.
 *
 * Doctrine: Contradictions must REDUCE confidence; they must never
 * average away into a higher composite. See QUESTION_POOL_v2_0_ROADMAP.md.
 */

export type ContradictionSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Severity-to-penalty mapping. Penalties subtract from a 0..1 confidence
 * envelope value. Calibrated so a single CRITICAL contradiction is
 * sufficient to trigger a `caution` state.
 */
const SEVERITY_TO_CONFIDENCE_PENALTY: Record<ContradictionSeverity, number> = {
  low: 0.05,
  medium: 0.12,
  high: 0.22,
  critical: 0.35,
};

export function confidencePenaltyForSeverity(
  severity: ContradictionSeverity,
): number {
  return SEVERITY_TO_CONFIDENCE_PENALTY[severity];
}

/**
 * Compose penalties from multiple contradictions using diminishing
 * combination: each subsequent penalty contributes at 70 % of nominal,
 * preventing piling-on while still ensuring multiple contradictions
 * compound.
 */
export function composeContradictionPenalties(
  severities: ReadonlyArray<ContradictionSeverity>,
): number {
  if (severities.length === 0) return 0;
  const sorted = [...severities].sort(
    (a, b) =>
      SEVERITY_TO_CONFIDENCE_PENALTY[b] - SEVERITY_TO_CONFIDENCE_PENALTY[a],
  );
  let total = 0;
  for (let i = 0; i < sorted.length; i++) {
    const nominal = SEVERITY_TO_CONFIDENCE_PENALTY[sorted[i]];
    total += nominal * Math.pow(0.7, i);
  }
  // Cap at 0.7 — no single contradiction surface may collapse confidence
  // below the floor reviewers must still interpret against.
  return Math.min(total, 0.7);
}
