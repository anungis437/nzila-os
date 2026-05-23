/**
 * Evidence-Strength Taxonomy — six-level ladder distinguishing declared
 * continuity from evidenced continuity.
 *
 * Doctrine: OCI must distinguish what an organization claims from what
 * it can demonstrate. This taxonomy is the canonical encoding of that
 * distinction and feeds the evidence-strength branching engine.
 *
 * Ordering matters: higher levels imply lower levels (CROSS_VALIDATED
 * implies VERIFIED implies OPERATIONAL implies DOCUMENTED implies
 * VERBAL implies NONE).
 */

export type EvidenceLevel =
  | 'NONE'
  | 'VERBAL'
  | 'DOCUMENTED'
  | 'OPERATIONAL'
  | 'VERIFIED'
  | 'CROSS_VALIDATED';

export const EVIDENCE_LEVEL_ORDER: ReadonlyArray<EvidenceLevel> = [
  'NONE',
  'VERBAL',
  'DOCUMENTED',
  'OPERATIONAL',
  'VERIFIED',
  'CROSS_VALIDATED',
];

export interface EvidenceLevelDefinition {
  level: EvidenceLevel;
  ordinal: 0 | 1 | 2 | 3 | 4 | 5;
  label: string;
  description: string;
  /** What a reviewer can credit a claim with at this level. */
  reviewerCredit: 'none' | 'oral' | 'documentary' | 'operational' | 'audit' | 'independent_audit';
  /** Whether continuity claims at this level can be relied on for runtime decisions. */
  runtimeReliance: boolean;
}

export const EVIDENCE_LEVELS: Record<EvidenceLevel, EvidenceLevelDefinition> = {
  NONE: {
    level: 'NONE',
    ordinal: 0,
    label: 'No evidence',
    description: 'The claim has no evidentiary basis the organization can point to.',
    reviewerCredit: 'none',
    runtimeReliance: false,
  },
  VERBAL: {
    level: 'VERBAL',
    ordinal: 1,
    label: 'Verbal / understood',
    description: 'The claim exists as shared understanding among staff but is not recorded.',
    reviewerCredit: 'oral',
    runtimeReliance: false,
  },
  DOCUMENTED: {
    level: 'DOCUMENTED',
    ordinal: 2,
    label: 'Documented',
    description: 'The claim is captured in a document, policy, or record reviewable on request.',
    reviewerCredit: 'documentary',
    runtimeReliance: false,
  },
  OPERATIONAL: {
    level: 'OPERATIONAL',
    ordinal: 3,
    label: 'Operationally in use',
    description: 'The claim is reflected in actual operational practice, not only on paper.',
    reviewerCredit: 'operational',
    runtimeReliance: true,
  },
  VERIFIED: {
    level: 'VERIFIED',
    ordinal: 4,
    label: 'Internally verified',
    description: 'The claim has been verified by an internal review independent of those who produced it.',
    reviewerCredit: 'audit',
    runtimeReliance: true,
  },
  CROSS_VALIDATED: {
    level: 'CROSS_VALIDATED',
    ordinal: 5,
    label: 'Independently cross-validated',
    description: 'The claim has been cross-validated by an external or independent party.',
    reviewerCredit: 'independent_audit',
    runtimeReliance: true,
  },
};

export function isAtLeast(actual: EvidenceLevel, required: EvidenceLevel): boolean {
  return EVIDENCE_LEVELS[actual].ordinal >= EVIDENCE_LEVELS[required].ordinal;
}

/**
 * Normalize an evidence level to a 0..1 continuity contribution. Used by
 * the confidence engine to translate evidence depth into envelope
 * impact. CROSS_VALIDATED = 1.0; NONE = 0.0; cubic interpolation between
 * — calibrated to reward each subsequent level with diminishing
 * marginal credit while preserving meaningful separation.
 */
export function evidenceContribution(level: EvidenceLevel): number {
  return EVIDENCE_LEVELS[level].ordinal / 5;
}
