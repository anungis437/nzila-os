/**
 * Shared evidence-basis vocabulary for organizational cognition/intelligence engines.
 *
 * Family: DEF-0B7 organizational intelligence, evidence and cognition findings.
 *
 * These engines (behaviour patterns, governance culture, learning archetypes, succession
 * readiness, continuity risk, resilience index, learning trajectory, and others under
 * lib/knowledge-transfer/) characterize an organization from cognition-memory entries,
 * reasoning sessions, and exit-interview records. Those records are officer-typed
 * observations and self-reported snapshots, not independently verified measurements of
 * governance outcomes. Below a minimum sample size, or with no recorded value for a
 * figure at all, there is nothing to measure - the shared rule enforced here is: do not
 * let a scoring formula's own "zero (or sparse) in, confident label out" behavior stand in
 * for an explicit insufficient-evidence result. A caller must always be able to tell
 * "nothing was recorded" from "something was recorded and it happened to be a low or zero
 * value".
 */

/**
 * Minimum number of records before an aggregate figure describes more than a handful of
 * specific individuals' own data, rather than an organizational pattern. Matches the
 * repo's existing small-cell convention (e.g. app/api/breaks/compliance,
 * lib/knowledge-transfer/succession/succession-analyzer.ts).
 */
export const MIN_COHORT_SIZE = 5;

/**
 * A 0-100 confidence figure derived from how many interactions/entries/records informed a
 * classification - not from any statistical measure of correctness. Zero interactions
 * means nothing was observed, so confidence is 0, never a floor value that would read as a
 * confidently-measured result on an empty history.
 */
export function confidenceFromSampleSize(sampleSize: number): number {
  if (sampleSize <= 0) return 0;
  if (sampleSize >= 10) return 80;
  if (sampleSize >= MIN_COHORT_SIZE) return 60;
  return 40;
}

/**
 * Average of recorded scores, or null when none were recorded. Returning 0 for an empty
 * array would be indistinguishable from a genuinely measured average of zero - callers
 * must be able to tell "no score was ever recorded" from "a score was recorded and it was
 * zero" by the shape of the result, not by the number alone.
 */
export function averageOrNull(scores: readonly number[]): number | null {
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/**
 * Whether a sample is large enough that a per-cohort figure no longer reads as a specific
 * small number of individuals' own data. Below this, aggregate figures should be withheld
 * (small-cell suppression) rather than computed and shown.
 */
export function meetsMinimumCohort(sampleSize: number): boolean {
  return sampleSize >= MIN_COHORT_SIZE;
}

/**
 * A 'low' | 'medium' | 'high' confidence label derived from how many nodes/signals/records
 * actually underlie a single claim or evidence reference - not a fixed literal chosen by
 * category or evidence type. Shared by the decision-brief, copilot-explainability and
 * propagation-derived evidence builders so the same count always implies the same label.
 */
export function confidenceLabelFromCount(count: number): 'low' | 'medium' | 'high' {
  if (count >= MIN_COHORT_SIZE) return 'high';
  if (count >= 2) return 'medium';
  return 'low';
}
