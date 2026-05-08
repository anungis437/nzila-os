/**
 * Institutional Behavior Pattern Models
 *
 * Data structures for recurring organizational continuity behavior patterns.
 *
 * SCOPE: Organizational-level patterns — NOT individual employee profiling.
 * All patterns characterize how an institution collectively behaves around governance.
 */

/** The type of recurring institutional behavior pattern. */
export type BehaviorPatternType =
  | 'resilience_improvement_cycle'   // Org repeatedly improves after gaps
  | 'governance_engagement_loop'     // Regular engagement followed by stagnation
  | 'mitigation_avoidance'          // Risks identified but mitigations deferred
  | 'continuity_planning_adoption'  // Growing adoption of continuity practices
  | 'reactive_stabilization'        // Reacts to crisis, stabilizes, then disengages
  | 'adaptive_learning_loop'        // Learns from each governance cycle
  | 'governance_stagnation'         // Extended periods of no governance activity
  | 'resilience_fragility_pattern'  // Score improvements followed by reversals
  | 'documentation_momentum';       // Building documentation practices over time

/** Strength of evidence behind the detected pattern. */
export type PatternEvidenceStrength = 'strong' | 'moderate' | 'weak' | 'tentative';

/** A single detected institutional behavior pattern. */
export interface InstitutionalBehaviorPattern {
  id: string;
  patternType: BehaviorPatternType;
  /** Human-readable label for the pattern. */
  label: string;
  /** Narrative description of what was observed. */
  description: string;
  /** Specific evidence instances that support this pattern. */
  evidencePoints: string[];
  /** Number of times this pattern has been observed. */
  occurrenceCount: number;
  /** Evidence strength. */
  evidenceStrength: PatternEvidenceStrength;
  /** Whether this pattern is currently active / ongoing. */
  isCurrentlyActive: boolean;
  /** Governance implication of this pattern. */
  governanceImplication: string;
  /** First observed timestamp. */
  firstObservedAt: string | null;
  /** Most recent observation timestamp. */
  mostRecentAt: string | null;
}

/** Institutional behavior pattern summary report. */
export interface BehaviorPatternReport {
  organizationId: string;
  analyzedAt: string;
  /** Detected patterns ranked by evidence strength. */
  patterns: InstitutionalBehaviorPattern[];
  /** The most dominant pattern. */
  dominantPattern: BehaviorPatternType | null;
  /** Overall institutional learning signal. */
  learningSignal: 'active_learning' | 'periodic_learning' | 'passive_learning' | 'insufficient_history';
  /** Narrative of institutional behavioral observations. */
  behaviorNarrative: string;
  /** Number of memory entries analyzed. */
  entriesAnalyzed: number;
  /** Governance-safe interpretation disclaimer. */
  interpretationGuidance: string;
}
