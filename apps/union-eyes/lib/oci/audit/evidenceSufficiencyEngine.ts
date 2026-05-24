/**
 * ARTIFACT TYPE: IP / Framework
 * MODULE: lib/oci/audit/evidenceSufficiencyEngine (Evidence Sufficiency Engine™)
 * DOCTRINE_VERSION: 1.0.0
 *
 * Hard doctrine: governance entropy must FAIL CAUTIOUSLY, NOT INFER AGGRESSIVELY.
 *
 * Composes observable evidence into a sufficiency verdict. Detects
 * contradictions between strong observations. Always returns a
 * rationale array. Pure, deterministic, no I/O.
 */

import type {
  EvidenceObservation,
  SufficiencyResult,
  SufficiencyVerdict,
} from './entropyAuditContracts';
import { describeEvidence, strengthMultiplier } from './observableEvidenceTaxonomy';

const SUFFICIENT_THRESHOLD = 2.5;
const PARTIAL_THRESHOLD = 1.0;
const MIN_OBSERVATIONS_FOR_HIGH = 3;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function detectContradictions(observations: ReadonlyArray<EvidenceObservation>): string[] {
  const strongPositive = observations.filter(
    (o) => o.evidenceStrength === 'strong' && o.evidenceConfidence >= 0.7,
  );
  const strongCounter = observations.filter(
    (o) => o.evidenceStrength === 'strong' && o.evidenceConfidence < 0.3,
  );
  if (strongPositive.length > 0 && strongCounter.length > 0) {
    return [
      `contradiction: ${strongPositive.length} strong-positive observation(s) vs ${strongCounter.length} strong-counter observation(s)`,
    ];
  }
  return [];
}

export function evaluateEvidenceSufficiency(
  observations: ReadonlyArray<EvidenceObservation>,
): SufficiencyResult {
  if (observations.length === 0) {
    return Object.freeze({
      sufficiency: 'insufficient' as SufficiencyVerdict,
      confidence: 'low' as const,
      escalationRequired: true,
      contradictionsDetected: false,
      rationale: Object.freeze(['no observations recorded; sufficiency fails cautiously']),
    });
  }

  let aggregate = 0;
  const rationale: string[] = [];

  for (const obs of observations) {
    const entry = describeEvidence(obs.evidenceType);
    const mult = strengthMultiplier(obs.evidenceStrength);
    const evidenceConf = clamp01(obs.evidenceConfidence);
    const reviewerConf = clamp01(obs.reviewerConfidence);
    const contribution = entry.baseWeight * mult * evidenceConf * reviewerConf;
    aggregate += contribution;
    rationale.push(
      `${obs.evidenceType}/${obs.evidenceStrength} from ${obs.evidenceSource}: +${contribution.toFixed(3)}`,
    );
  }

  const contradictions = detectContradictions(observations);
  const contradictionsDetected = contradictions.length > 0;
  rationale.push(...contradictions);

  let sufficiency: SufficiencyVerdict;
  if (aggregate >= SUFFICIENT_THRESHOLD && observations.length >= MIN_OBSERVATIONS_FOR_HIGH) {
    sufficiency = 'sufficient';
  } else if (aggregate >= PARTIAL_THRESHOLD) {
    sufficiency = 'partial';
  } else {
    sufficiency = 'insufficient';
  }

  // Caution-first: contradictions force the verdict to at most 'partial'.
  if (contradictionsDetected && sufficiency === 'sufficient') {
    sufficiency = 'partial';
    rationale.push('contradiction detected: downgrading sufficiency to partial (fail cautiously)');
  }

  const confidence: 'high' | 'moderate' | 'low' =
    sufficiency === 'sufficient' && !contradictionsDetected
      ? 'high'
      : sufficiency === 'partial'
        ? 'moderate'
        : 'low';

  const escalationRequired =
    sufficiency !== 'sufficient' || contradictionsDetected;

  rationale.push(`aggregate=${aggregate.toFixed(3)}; sufficiency=${sufficiency}; confidence=${confidence}`);

  return Object.freeze({
    sufficiency,
    confidence,
    escalationRequired,
    contradictionsDetected,
    rationale: Object.freeze(rationale),
  });
}

export const SUFFICIENCY_THRESHOLDS = Object.freeze({
  sufficient: SUFFICIENT_THRESHOLD,
  partial: PARTIAL_THRESHOLD,
  minObservationsForHigh: MIN_OBSERVATIONS_FOR_HIGH,
});
