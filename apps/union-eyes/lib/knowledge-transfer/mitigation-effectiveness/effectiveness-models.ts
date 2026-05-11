/**
 * Mitigation Effectiveness Models
 *
 * Data structures for measuring organizational continuity intervention effectiveness.
 * Evaluates whether mitigations actually improved resilience over time.
 *
 * Scope: organizational continuity effectiveness ONLY.
 * Never workforce effectiveness.
 */

export type EffectivenessRating =
  | 'highly_effective'
  | 'moderately_effective'
  | 'marginally_effective'
  | 'ineffective'
  | 'counterproductive'
  | 'unverified';

export interface MitigationIntervention {
  id: string;
  title: string;
  recordedAt: string;
  memoryEntryId: string;
  resilienceScoreAtRecording: number | null;
  tags: string[];
}

export interface MitigationOutcome {
  interventionId: string;
  interventionTitle: string;
  recordedAt: string;
  resilienceAtIntervention: number | null;
  resilienceAfter: number | null;
  scoreChange: number | null;
  effectivenessRating: EffectivenessRating;
  /** Estimated resilience ROI (score gain per intervention) */
  resilienceRoi: number | null;
  daysToObservableEffect: number | null;
}

export interface EffectivenessDimension {
  dimension: string;
  averageScoreChange: number;
  interventionCount: number;
  effectivenessRating: EffectivenessRating;
}

export interface MitigationEffectivenessReport {
  organizationId: string;
  generatedAt: string;
  /** All measured mitigation outcomes */
  outcomes: MitigationOutcome[];
  /** Dimension-level aggregations */
  dimensionBreakdown: EffectivenessDimension[];
  /** Average resilience gain per intervention */
  averageResilienceGain: number;
  /** Most effective intervention on record */
  mostEffectiveIntervention: MitigationOutcome | null;
  /** Least effective / failed interventions */
  ineffectiveInterventions: MitigationOutcome[];
  /** Interventions without enough follow-up to verify */
  unverifiedInterventions: MitigationIntervention[];
  /** Overall effectiveness health */
  overallEffectivenessRating: EffectivenessRating;
  /** Governance recommendation based on effectiveness history */
  continuityRecommendation: string;
}
