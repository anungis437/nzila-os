/**
 * Institutional Learning Trajectory Models
 *
 * Data structures for longitudinal continuity evolution and maturity progression analysis.
 *
 * SCOPE: Organizational learning trajectories — NOT workforce analytics.
 * These characterize how institutional continuity governance evolves over time.
 */

/** A single point on the learning trajectory timeline. */
export interface TrajectoryDataPoint {
  /** ISO timestamp. */
  capturedAt: string;
  /** Resilience score at this point. */
  resilienceScore: number;
  /** Cumulative governance interactions up to this point. */
  cumulativeInteractions: number;
  /** Whether a governance intervention was recorded near this point. */
  hasIntervention: boolean;
}

/** The learning acceleration indicator. */
export type LearningMomentum =
  | 'accelerating'      // Learning is speeding up
  | 'steady'            // Consistent, stable learning pace
  | 'decelerating'      // Learning is slowing down
  | 'stalled'           // Learning has paused
  | 'insufficient_data';// Not enough history

/** A forecasted trajectory point. */
export interface TrajectoryForecastPoint {
  /** Month offset from now. */
  monthsAhead: number;
  /** Forecasted resilience score. */
  forecastedScore: number;
  /** Confidence range. */
  confidenceRange: { low: number; high: number };
}

/** A maturity milestone. */
export interface MaturityMilestone {
  label: string;
  /** Resilience score threshold for this milestone. */
  scoreThreshold: number;
  /** Whether the org has reached this milestone. */
  achieved: boolean;
  /** When it was achieved (null if not yet). */
  achievedAt: string | null;
}

/** Full institutional learning trajectory report. */
export interface LearningTrajectoryReport {
  organizationId: string;
  analyzedAt: string;
  /** Trajectory data points (chronological). */
  trajectoryPoints: TrajectoryDataPoint[];
  /** Learning momentum. */
  momentum: LearningMomentum;
  /** Momentum narrative. */
  momentumNarrative: string;
  /** Short-term forecast (3–6 months). */
  forecast: TrajectoryForecastPoint[];
  /** Maturity milestones. */
  milestones: MaturityMilestone[];
  /** Total trajectory span in days. */
  trajectorySpanDays: number | null;
  /** Governance interactions per month (density). */
  interactionsPerMonth: number | null;
  /** Estimated months to next maturity milestone. */
  estimatedMonthsToNextMilestone: number | null;
  /** Entries analyzed. */
  entriesAnalyzed: number;
  /** Governance-safe disclaimer. */
  interpretationGuidance: string;
}
