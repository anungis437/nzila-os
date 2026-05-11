/**
 * Adaptive Resilience Models
 *
 * Data structures for history-informed, adaptive continuity recommendations.
 * Recommendations are adjusted based on what has worked historically.
 *
 * All adaptations must expose WHY they changed — full explainability.
 */

export type AdaptationReason =
  | 'historically_effective'
  | 'repeatedly_failed'
  | 'score_correlation'
  | 'high_frequency_success'
  | 'unproven_approach'
  | 'governance_stabilizing'
  | 'dependency_reduction_success';

export interface AdaptedRecommendation {
  id: string;
  headline: string;
  originalPriority: number;
  adaptedPriority: number;
  priorityDelta: number;
  adaptationReason: AdaptationReason;
  /** What historical evidence drove this adaptation */
  historicalEvidence: string;
  /** Estimated resilience gain adjusted by history */
  adjustedResilienceGain: number;
  /** Original estimated gain */
  originalResilienceGain: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface ResilienceAdaptationSummary {
  /** How many recommendations were adjusted upward */
  elevatedCount: number;
  /** How many recommendations were adjusted downward */
  deprioritizedCount: number;
  /** How many had insufficient history to adjust */
  unadjustedCount: number;
  /** Overall adaptation confidence */
  overallConfidence: 'high' | 'medium' | 'low' | 'insufficient_history';
  /** Key learning that most influenced adaptations */
  primaryAdaptationDriver: string;
}

export interface AdaptiveResilienceResult {
  organizationId: string;
  generatedAt: string;
  /** Adapted recommendations ordered by adjusted priority */
  adaptedRecommendations: AdaptedRecommendation[];
  /** Summary of how history shaped the output */
  adaptationSummary: ResilienceAdaptationSummary;
  /** History entries that informed adaptations */
  historyEntriesUsed: number;
  /** Narrative explanation of adaptation logic */
  adaptationNarrative: string;
}
