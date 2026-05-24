/**
 * ARTIFACT TYPE: IP / Contracts
 * MODULE: lib/oci/audit/entropyAuditContracts
 * DOCTRINE_VERSION: 1.0.0
 *
 * Contracts for the Governance Entropy Audit Program™.
 */

import type { ConfidenceState, CautionState } from '@nzila/oci-confidence';

export const EVIDENCE_TYPES = [
  'Documentary',
  'Procedural',
  'Historical',
  'Operational',
  'Transitional',
  'Governance',
  'CrossFunctional',
  'Verbal',
] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const EVIDENCE_STRENGTHS = ['strong', 'moderate', 'weak', 'circumstantial'] as const;
export type EvidenceStrength = (typeof EVIDENCE_STRENGTHS)[number];

export interface EvidenceObservation {
  readonly evidenceType: EvidenceType;
  readonly evidenceStrength: EvidenceStrength;
  readonly evidenceSource: string;
  /** Reviewer-stated confidence in the evidence itself, in [0,1]. */
  readonly evidenceConfidence: number;
  /** Reviewer's overall confidence in their classification, in [0,1]. */
  readonly reviewerConfidence: number;
  /** Optional aggregated descriptor — NEVER include holder names or free-text. */
  readonly descriptor?: string;
}

export type SufficiencyVerdict = 'sufficient' | 'partial' | 'insufficient';

export interface SufficiencyResult {
  readonly sufficiency: SufficiencyVerdict;
  readonly confidence: 'high' | 'moderate' | 'low';
  readonly escalationRequired: boolean;
  readonly contradictionsDetected: boolean;
  readonly rationale: ReadonlyArray<string>;
}

export interface EntropyAuditPacket {
  readonly entropyOrdinal: 1 | 2 | 3 | 4 | 5;
  readonly observedEvidence: ReadonlyArray<EvidenceObservation>;
  readonly failedCriteria: ReadonlyArray<string>;
  readonly uncertaintyStates: ReadonlyArray<CautionState>;
  readonly reviewerNotes: ReadonlyArray<string>;
  readonly confidence: ConfidenceState;
  readonly contradictoryEvidence: ReadonlyArray<string>;
  readonly escalationFlags: ReadonlyArray<string>;
  readonly continuityCautionStates: ReadonlyArray<CautionState>;
  /** Stable, content-addressed hash for reproducibility. */
  readonly reproducibilityHash: string;
}

export interface ReviewerVarianceInput {
  readonly reviewerId: string;
  readonly entropyOrdinal: number;
  readonly classificationConfidence: number;
  readonly escalated: boolean;
}

export interface ReviewerVarianceResult {
  readonly reviewerAgreement: number;
  readonly entropyVariance: number;
  readonly escalationRate: number;
  readonly calibrationConfidence: ConfidenceState;
  readonly indicators: ReadonlyArray<string>;
}
