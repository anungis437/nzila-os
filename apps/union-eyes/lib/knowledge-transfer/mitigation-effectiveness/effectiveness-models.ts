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
  /** Why no outcome could be read for it (set only on the unverified list). */
  unverifiedReason?: 'no_recorded_score' | 'no_baseline_in_window' | 'other_intervention_in_window';
}

/** The days after an intervention within which a later baseline can be read as its follow-up. */
export const OBSERVATION_WINDOW_DAYS = 90;

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
  /**
   * A score change that follows an intervention is an association in officer-recorded scores, not a measured effect: other
   * work in the window is not controlled for, so only a window with a single intervention is read at all.
   */
  attribution: 'association_not_causation';
  observationWindowDays: number;
  /** Overall effectiveness health */
  overallEffectivenessRating: EffectivenessRating;
  /** Governance recommendation based on effectiveness history */
  continuityRecommendation: string;
}
