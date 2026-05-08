/**
 * Governance Adaptation Models
 *
 * Data structures for longitudinal governance reasoning evolution.
 * Tracks how governance reasoning adapts over time based on outcomes.
 */

export type GovernanceAdaptationEventType =
  | 'session_created'
  | 'memory_captured'
  | 'resilience_improved'
  | 'resilience_declined'
  | 'governance_decision_made'
  | 'mitigation_recorded'
  | 'pattern_detected';

export interface GovernanceAdaptationEvent {
  id: string;
  eventType: GovernanceAdaptationEventType;
  description: string;
  resilienceScoreAtEvent: number | null;
  occurredAt: string;
  sessionId: string | null;
  memoryEntryId: string | null;
}

export interface RecurringPattern {
  patternType: 'recurring_failure' | 'successful_adaptation' | 'stagnation';
  description: string;
  occurrenceCount: number;
  firstDetectedAt: string;
  mostRecentAt: string;
  governanceImplication: string;
}

export interface GovernanceAdaptationTimeline {
  events: GovernanceAdaptationEvent[];
  totalEvents: number;
  earliestEvent: string | null;
  latestEvent: string | null;
  /** Summarized progression narrative */
  progressionNarrative: string;
}

export interface GovernanceAdaptationReport {
  organizationId: string;
  generatedAt: string;
  adaptationTimeline: GovernanceAdaptationTimeline;
  /** Recurring patterns detected */
  recurringPatterns: RecurringPattern[];
  /** Sessions analyzed */
  sessionsAnalyzed: number;
  /** Overall governance adaptation health */
  adaptationHealth:
    | 'actively_adapting'
    | 'slowly_adapting'
    | 'stagnant'
    | 'insufficient_history';
  /** Recommended next adaptation focus */
  nextFocusRecommendation: string;
}
