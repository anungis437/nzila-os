/**
 * ARTIFACT TYPE: Government-Readiness Additive Layer — Per-Finding Confidence
 * MODULE: OCI/OCRA finding-level confidence envelope
 * DOCTRINE: docs/oci/superseded/government-readiness/OCI_OCRA_CONFIDENCE_ARCHITECTURE.md
 * DOCTRINE_VERSION: 1.0.0
 *
 * Builds a Universal Confidence Envelope at FINDING granularity, fed by the
 * existing six-level evidence ladder. Reuses the package's decay engine
 * (classifyDecay / applyDecay) so temporal degradation is consistent with the
 * assessment-level model.
 *
 * HONESTY INVARIANTS:
 *   - Evidence level is the GOVERNING cap. No factor combination can raise a
 *     finding's confidence above the band implied by its evidence.
 *     (Enforced by confidence-evidence-floor.test.ts.)
 *   - Output is an ordinal band — never a probability or percentage.
 *   - The `min`-band discipline holds: the weakest factor governs.
 */

import {
  applyDecay,
  classifyDecay,
  type CautionState,
  type ConfidenceEnvelope,
  type ConfidenceState,
} from '@nzila/oci-confidence';
import {
  evidenceContribution,
  isAtLeast,
  type EvidenceLevel,
} from '../evidence-strength/evidenceTaxonomy';

const HIGH_VARIANCE_THRESHOLD = 0.4;

const STATE_ORDER: Record<ConfidenceState, number> = {
  HIGH: 3,
  MODERATE: 2,
  LOW: 1,
  INSUFFICIENT: 0,
};

function lowerState(a: ConfidenceState, b: ConfidenceState): ConfidenceState {
  return STATE_ORDER[a] <= STATE_ORDER[b] ? a : b;
}

/**
 * Map the six-level evidence ladder to a confidence band. This band is the
 * authoritative ceiling for a finding's confidence.
 *
 *   CROSS_VALIDATED / VERIFIED  -> HIGH
 *   OPERATIONAL / DOCUMENTED    -> MODERATE
 *   VERBAL                      -> LOW
 *   NONE                        -> INSUFFICIENT
 */
export function evidenceBandFor(level: EvidenceLevel): ConfidenceState {
  switch (level) {
    case 'CROSS_VALIDATED':
    case 'VERIFIED':
      return 'HIGH';
    case 'OPERATIONAL':
    case 'DOCUMENTED':
      return 'MODERATE';
    case 'VERBAL':
      return 'LOW';
    case 'NONE':
      return 'INSUFFICIENT';
  }
}

export interface FindingConfidenceInput {
  readonly evidenceLevel: EvidenceLevel;
  /** True when ≥2 independent evidence items support the finding. */
  readonly corroborated?: boolean;
  /** Inter-reviewer variance in [0,1]; higher means more disagreement. */
  readonly reviewerVariance?: number;
  /** Age of the underlying assessment in days, for temporal decay. */
  readonly assessmentAgeDays?: number;
}

function clamp01(n: number | undefined): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * Build a per-finding confidence envelope. The evidence band is the governing
 * ceiling; reviewer variance and temporal decay can only lower it further.
 *
 * The score payload is `null` — confidence is ABOUT a finding, never part of a
 * score.
 */
export function buildFindingConfidence(
  input: FindingConfidenceInput,
): ConfidenceEnvelope<null> {
  const evidenceBand = evidenceBandFor(input.evidenceLevel);
  const variance = clamp01(input.reviewerVariance);
  const ageDays =
    typeof input.assessmentAgeDays === 'number' && Number.isFinite(input.assessmentAgeDays)
      ? Math.max(0, input.assessmentAgeDays)
      : null;

  // Evidence is the governing cap. Begin at the evidence band and only lower.
  let base: ConfidenceState = evidenceBand;
  if (variance >= HIGH_VARIANCE_THRESHOLD) base = lowerState(base, 'LOW');

  const decay = classifyDecay(ageDays);
  const finalConfidence = applyDecay(base, decay.band);

  const cautions: CautionState[] = [];
  if (!isAtLeast(input.evidenceLevel, 'DOCUMENTED')) cautions.push('LIMITED_GOVERNANCE_EVIDENCE');
  if (input.evidenceLevel !== 'CROSS_VALIDATED' && !input.corroborated) {
    cautions.push('INCOMPLETE_VISIBILITY');
  }
  if (variance >= HIGH_VARIANCE_THRESHOLD) cautions.push('HIGH_VARIANCE');
  if (decay.caution) cautions.push(decay.caution);

  const rationale: string[] = [
    `evidence: ${input.evidenceLevel} (band ${evidenceBand})`,
    `corroborated: ${input.corroborated ? 'yes' : 'no'}`,
    `decay: ${decay.band}${ageDays != null ? ` at ${ageDays}d` : ''}`,
  ];
  if (variance > 0) rationale.push(`reviewer variance: ${variance.toFixed(2)}`);
  rationale.push(`final confidence: ${finalConfidence}`);

  return Object.freeze({
    score: null,
    confidence: finalConfidence,
    sampleSize: input.corroborated ? 2 : 1,
    dataCompleteness: evidenceContribution(input.evidenceLevel),
    stability: 'UNKNOWN',
    cautionStates: Object.freeze(Array.from(new Set(cautions))),
    confidenceRationale: Object.freeze(rationale),
    decay: decay.band,
    assessmentAgeDays: ageDays,
  });
}
