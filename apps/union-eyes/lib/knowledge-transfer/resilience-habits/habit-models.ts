/**
 * Resilience Habit Formation Models
 *
 * Data structures for tracking continuity-strengthening operational habits.
 *
 * SCOPE: Institutional habits — NOT individual performance metrics.
 * These characterize how an organization operationally invests in continuity resilience.
 */

/** A measurable institutional resilience habit dimension. */
export type ResilienceHabitDimension =
  | 'review_cadence'           // Regularity of continuity governance reviews
  | 'mitigation_follow_through'// Consistency of acting on identified mitigations
  | 'documentation_discipline' // Quality and regularity of institutional documentation
  | 'governance_responsiveness'// Speed and thoroughness of governance engagement
  | 'continuity_planning'      // Active investment in continuity planning
  | 'resilience_assessment';   // Regular resilience measurement and tracking

/** Score tier for a habit dimension. */
export type HabitTier = 'strong' | 'developing' | 'emerging' | 'absent';

/** Assessment of a single resilience habit dimension. */
export interface HabitDimensionScore {
  dimension: ResilienceHabitDimension;
  /** Human-readable dimension label. */
  label: string;
  /** 0–100 score. */
  score: number;
  /** Tier classification. */
  tier: HabitTier;
  /** Observation narrative. */
  observation: string;
  /** Specific evidence. */
  evidence: string;
  /** Recommended next step for this dimension. */
  recommendation: string;
}

/** Overall resilience habit formation profile. */
export interface ResilienceHabitProfile {
  organizationId: string;
  analyzedAt: string;
  /** Weighted composite habit score 0–100. */
  overallHabitScore: number;
  /** Overall habit formation tier. */
  overallTier: HabitTier;
  /** Individual dimension scores. */
  dimensions: HabitDimensionScore[];
  /** Strongest habit dimension. */
  strongestHabit: ResilienceHabitDimension | null;
  /** Habit dimension most in need of development. */
  developmentPriority: ResilienceHabitDimension | null;
  /** Institutional narrative of habit formation progress. */
  habitNarrative: string;
  /** 0–100 consistency score (how consistently habits are maintained over time). */
  consistencyScore: number;
  /** Number of entries analyzed. */
  entriesAnalyzed: number;
  /** Governance-safe interpretation guidance. */
  interpretationGuidance: string;
}
