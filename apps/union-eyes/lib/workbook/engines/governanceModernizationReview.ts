/**
 * ARTIFACT TYPE: Engine Helper
 * MODULE: Modernization Alignment
 * DOCTRINE_VERSION: 2.0.0
 *
 * Governance Modernization Review — examines whether modernization
 * initiatives are reviewed and ratified by governance bodies, and
 * whether that governance review is itself coherent with governance
 * design.
 *
 * Pure, deterministic.
 */

import type {
  ContinuitySafeModernizationCell,
  ContinuityPosture,
} from './continuitySafeModernization';

export interface GovernanceReviewInput {
  /** Stable abstract id matching ModernizationInitiativeInput.id. */
  readonly initiativeId: string;
  readonly initiativeLabel: string;
  /** True if a governance body has formally reviewed the initiative. */
  readonly reviewedByGovernance: boolean;
  /** True if review occurred at the appropriate governance level. */
  readonly reviewedAtAppropriateLevel: boolean;
  /** True if continuity implications were explicitly part of the review. */
  readonly continuityImplicationsAssessed: boolean;
}

export type GovernanceReviewPosture =
  | 'governance_ratified'
  | 'governance_consulted'
  | 'governance_aware'
  | 'governance_absent';

export interface GovernanceReviewCell {
  readonly initiativeId: string;
  readonly initiativeLabel: string;
  readonly posture: GovernanceReviewPosture;
  readonly reading: string;
}

const REVIEW_READING: Record<GovernanceReviewPosture, string> = {
  governance_ratified:
    'Initiative was reviewed by the appropriate governance body and continuity implications were explicitly assessed.',
  governance_consulted:
    'Initiative was reviewed by a governance body but continuity implications were not explicitly assessed.',
  governance_aware:
    'A governance body is aware of the initiative but has not formally reviewed it at the appropriate level.',
  governance_absent:
    'No governance review has occurred for this initiative.',
};

export function reviewGovernanceModernization(
  inputs: readonly GovernanceReviewInput[],
): readonly GovernanceReviewCell[] {
  return inputs.map((i) => {
    const posture = classifyReview(i);
    return {
      initiativeId: i.initiativeId,
      initiativeLabel: i.initiativeLabel,
      posture,
      reading: REVIEW_READING[posture],
    };
  });
}

function classifyReview(i: GovernanceReviewInput): GovernanceReviewPosture {
  if (i.reviewedByGovernance && i.reviewedAtAppropriateLevel && i.continuityImplicationsAssessed) {
    return 'governance_ratified';
  }
  if (i.reviewedByGovernance && i.reviewedAtAppropriateLevel) return 'governance_consulted';
  if (i.reviewedByGovernance) return 'governance_aware';
  return 'governance_absent';
}

export interface ModernizationContinuityGap {
  readonly initiativeId: string;
  readonly initiativeLabel: string;
  readonly modernizationPosture: ContinuityPosture;
  readonly governancePosture: GovernanceReviewPosture;
  readonly gapKind: 'aligned' | 'governance_lag' | 'continuity_lag' | 'compound_gap';
  readonly reading: string;
}

export function computeModernizationContinuityGaps(
  modernization: readonly ContinuitySafeModernizationCell[],
  review: readonly GovernanceReviewCell[],
): readonly ModernizationContinuityGap[] {
  const reviewById = new Map(review.map((r) => [r.initiativeId, r]));
  return modernization.map((m) => {
    const r = reviewById.get(m.id);
    const govPosture = r?.posture ?? 'governance_absent';
    const govStrong = govPosture === 'governance_ratified' || govPosture === 'governance_consulted';
    const contStrong = m.posture === 'continuity_safe' || m.posture === 'continuity_aware';
    let gapKind: ModernizationContinuityGap['gapKind'];
    if (govStrong && contStrong) gapKind = 'aligned';
    else if (govStrong && !contStrong) gapKind = 'continuity_lag';
    else if (!govStrong && contStrong) gapKind = 'governance_lag';
    else gapKind = 'compound_gap';
    return {
      initiativeId: m.id,
      initiativeLabel: m.label,
      modernizationPosture: m.posture,
      governancePosture: govPosture,
      gapKind,
      reading: buildGapReading(gapKind, m.posture, govPosture),
    };
  });
}

function buildGapReading(
  gap: ModernizationContinuityGap['gapKind'],
  m: ContinuityPosture,
  g: GovernanceReviewPosture,
): string {
  switch (gap) {
    case 'aligned':
      return 'Modernization and governance review are mutually aligned around organizational continuity.';
    case 'governance_lag':
      return 'Modernization is continuity-aware but governance review has not caught up.';
    case 'continuity_lag':
      return 'Governance review is present but the initiative itself does not yet engage organizational continuity.';
    case 'compound_gap':
      return 'Neither continuity engagement nor governance review is in place for this initiative.';
  }
}
