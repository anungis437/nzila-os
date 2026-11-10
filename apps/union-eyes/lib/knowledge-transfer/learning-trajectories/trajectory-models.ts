/**
 * Organizational Learning Trajectory Models
 *
 * Data structures for longitudinal continuity evolution and maturity progression analysis.
 *
 * SCOPE: Organizational learning trajectories — NOT workforce analytics.
 * These characterize how organizational continuity governance evolves over time.
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
  /**
   * A linear extrapolation from the typed resilience score history, adjusted by a momentum multiplier. Not a
   * statistical forecast. Only produced when forecastStatus is 'available' (see LearningTrajectoryReport).
   */
  forecastedScore: number;
  /**
   * A fixed formula (min(monthsAhead * 3, 20) points either side), not an interval computed from the data's own
   * variance or spread - widens with time horizon alone, never with how few or scattered the underlying typed
   * scores actually are. Do not read this as a statistical confidence interval.
   */
  projectionBand: { low: number; high: number };
}

/**
 * Whether a forecast was actually produced. 'unavailable_insufficient_data' when there are too few resilience
 * timeline points to extrapolate from at all - a two-point linear extrapolation is not a forecast, so none is
 * offered below the minimum (DEF-0B7-COGB-LEARNING-TRAJECTORY-FORECAST-EXTRAPOLATES-TWO-TYPED-SCORES).
 */
export type TrajectoryForecastStatus = 'available' | 'unavailable_insufficient_data';

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

/** Full organizational learning trajectory report. */
export interface LearningTrajectoryReport {
  organizationId: string;
  analyzedAt: string;
  /** Trajectory data points (chronological). */
  trajectoryPoints: TrajectoryDataPoint[];
  /** Learning momentum. */
  momentum: LearningMomentum;
  /** Momentum narrative. */
  momentumNarrative: string;
  /** Short-term forecast (3–6 months). Empty when forecastStatus is 'unavailable_insufficient_data'. */
  forecast: TrajectoryForecastPoint[];
  /** Whether forecast actually contains a projection, or there was not enough history to extrapolate from at all. */
  forecastStatus: TrajectoryForecastStatus;
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
  /**
   * When forecastStatus is 'available': forecast/estimatedMonthsToNextMilestone are a linear extrapolation from
   * the typed resilience score history, momentum-adjusted; each forecast point's projectionBand is a fixed
   * formula (min(monthsAhead * 3, 20)), not a statistically derived interval. Not a probabilistic model. When
   * forecastStatus is 'unavailable_insufficient_data', no forecast was produced at all - trajectoryPoints is the
   * full observed series and is not itself withheld.
   */
  methodologyNote: string;
}
