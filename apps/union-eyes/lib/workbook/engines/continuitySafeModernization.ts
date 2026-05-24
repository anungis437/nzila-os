/**
 * ARTIFACT TYPE: Engine Helper
 * MODULE: Modernization Alignment
 * DOCTRINE_VERSION: 2.0.0
 *
 * Continuity-Safe Modernization — classifies a modernization initiative
 * against the institutional continuity it touches. AI capability remains
 * restrained, governance-aware, and secondary; the category is OCI, NOT
 * AI transformation.
 *
 * Pure, deterministic. Vocabulary is institutional, not consulting.
 */

export type ModernizationArc =
  | 'documentation'
  | 'workflow_rationalisation'
  | 'system_replacement'
  | 'capability_augmentation';

export type ContinuityPosture =
  | 'continuity_safe'
  | 'continuity_aware'
  | 'continuity_blind'
  | 'continuity_eroding';

export interface ModernizationInitiativeInput {
  /** Stable abstract id. */
  readonly id: string;
  /** Abstract initiative label. */
  readonly label: string;
  readonly arc: ModernizationArc;
  /** True if continuity carriers were consulted during design. */
  readonly carriersConsulted: boolean;
  /** True if lineage capture is in scope. */
  readonly lineageCaptureInScope: boolean;
  /** True if successor identification is supported by the initiative. */
  readonly successorIdentificationSupported: boolean;
  /** True if the initiative is expected to displace existing institutional practice. */
  readonly displacesExistingPractice: boolean;
}

export interface ContinuitySafeModernizationCell {
  readonly id: string;
  readonly label: string;
  readonly arc: ModernizationArc;
  readonly posture: ContinuityPosture;
  readonly score: number;
  readonly reading: string;
}

const POSTURE_READING: Record<ContinuityPosture, string> = {
  continuity_safe:
    'The initiative is designed to carry institutional continuity forward — carriers are consulted, lineage capture is in scope, and successor identification is supported.',
  continuity_aware:
    'The initiative shows awareness of institutional continuity but does not yet hold all three carrier consultation, lineage capture, and successor support.',
  continuity_blind:
    'The initiative does not explicitly engage with the institutional continuity it touches; continuity preservation is left to chance.',
  continuity_eroding:
    'The initiative displaces existing practice without lineage capture or carrier consultation. Continuity is at risk of erosion.',
};

export function classifyContinuitySafeModernization(
  initiatives: readonly ModernizationInitiativeInput[],
): readonly ContinuitySafeModernizationCell[] {
  return initiatives.map((i) => {
    const score = computeScore(i);
    const posture = classifyPosture(i, score);
    return {
      id: i.id,
      label: i.label,
      arc: i.arc,
      posture,
      score,
      reading: POSTURE_READING[posture],
    };
  });
}

function computeScore(i: ModernizationInitiativeInput): number {
  let score = 0;
  if (i.carriersConsulted) score += 0.4;
  if (i.lineageCaptureInScope) score += 0.3;
  if (i.successorIdentificationSupported) score += 0.3;
  if (i.displacesExistingPractice && !i.lineageCaptureInScope) score -= 0.3;
  return round2(Math.max(0, Math.min(1, score)));
}

function classifyPosture(
  i: ModernizationInitiativeInput,
  score: number,
): ContinuityPosture {
  if (i.displacesExistingPractice && !i.lineageCaptureInScope && !i.carriersConsulted) {
    return 'continuity_eroding';
  }
  if (score >= 0.75) return 'continuity_safe';
  if (score >= 0.4) return 'continuity_aware';
  return 'continuity_blind';
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
