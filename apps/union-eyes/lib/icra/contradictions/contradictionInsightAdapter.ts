/**
 * Contradiction-aware narrative adapter.
 *
 * Wires the v2 contradiction-detection engine into the v1 insight
 * engine surface. Pure / deterministic.
 *
 * Doctrine guarantees:
 *   - Never names individuals (only institutional patterns).
 *   - Calm, "quietly devastating" register — same tone contract as the
 *     other insight detectors.
 *   - Severity floor (lowest of `material|notable|observed`) is set by
 *     the strongest contradiction observed; multiple contradictions
 *     accumulate at the headline level, not by inflating severity.
 *   - Returns null when no contradictions fired (refusal-preserving).
 *
 * This adapter does NOT mutate the contradiction report or the
 * dimension scores; it only re-expresses already-evidenced contradiction
 * outcomes as a single narrative insight slot that the insight engine
 * can include alongside its existing seven detectors.
 */
import type {
  ContradictionOutcome,
  ContradictionReport,
} from './contradictionDetectionEngine';
import type { ContradictionSeverity } from './contradictionSeverityModel';
import type { ContinuityInsight, DimensionId, ExecutivePersonaId } from '../types';

const SEVERITY_RANK: Record<ContradictionSeverity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

const CONTRADICTION_DIMENSIONS: ReadonlyArray<DimensionId> = [
  'institutional_continuity',
  'governance_fragility',
  'trust_debt',
  'operational_memory',
  'transition_readiness',
];

function strongestSeverity(
  outcomes: ReadonlyArray<ContradictionOutcome>,
): ContradictionSeverity | null {
  let best: ContradictionSeverity | null = null;
  for (const o of outcomes) {
    if (!o.contradictionDetected || !o.contradictionSeverity) continue;
    if (best === null || SEVERITY_RANK[o.contradictionSeverity] > SEVERITY_RANK[best]) {
      best = o.contradictionSeverity;
    }
  }
  return best;
}

/**
 * Map contradiction severity → insight severity. Calibration:
 *   critical → material
 *   high     → notable
 *   medium   → notable
 *   low      → observed
 */
function mapSeverity(severity: ContradictionSeverity): ContinuityInsight['severity'] {
  switch (severity) {
    case 'critical':
      return 'material';
    case 'high':
    case 'medium':
      return 'notable';
    case 'low':
      return 'observed';
  }
}

/**
 * Build a single contradiction insight from a contradiction report.
 * Returns null when no contradictions fired.
 *
 * Persona is reserved for future per-persona copy variants; current
 * v1.2.1 implementation uses a single calm register that reads true to
 * every persona. The parameter is retained for signature parity with
 * the existing insight detectors.
 */
export function buildContradictionInsight(
  report: ContradictionReport,
  _persona?: ExecutivePersonaId,
): ContinuityInsight | null {
  const fired = report.outcomes.filter((o) => o.contradictionDetected);
  if (fired.length === 0) return null;

  const strongest = strongestSeverity(fired);
  if (strongest === null) return null;

  const dimensionsTouched = new Set<string>();
  for (const o of fired) {
    for (const d of o.reducesConfidenceIn) dimensionsTouched.add(d);
  }
  const dimsInvolved = CONTRADICTION_DIMENSIONS.filter((d) =>
    dimensionsTouched.has(d),
  );

  const count = fired.length;
  const headline =
    count === 1
      ? 'A continuity contradiction is sitting unresolved.'
      : `${count} continuity contradictions are sitting unresolved.`;

  const namedPair = fired[0]?.name ?? 'an unresolved pair';
  const body =
    count === 1
      ? `Two affirmed signals point in opposite directions (${namedPair}). ` +
        `Until the contradiction is reconciled, confidence in the affected ` +
        `dimensions should be read as provisional rather than settled.`
      : `Affirmed signals across ${count} pairs point in opposite directions ` +
        `(${namedPair}, …). Until these contradictions are reconciled, ` +
        `confidence in the affected dimensions should be read as ` +
        `provisional rather than settled.`;

  const evidenceBasis =
    `aggregate contradiction penalty ${report.aggregateConfidencePenalty.toFixed(2)}; ` +
    fired
      .map((o) => `${o.pairId} (${o.contradictionSeverity ?? 'n/a'})`)
      .join('; ');

  return {
    id: 'contradiction_detected',
    category: 'contradiction_detected',
    headline,
    body,
    dimensionsInvolved: dimsInvolved,
    severity: mapSeverity(strongest),
    evidenceBasis,
  };
}
