/**
 * Governance Momentum Models
 */

export interface GovernanceMomentumIndicator {
  governance_maturity_acceleration: number;
  resilience_momentum: number;
  continuity_improvement_velocity: number;
  institutional_learning_acceleration: number;
  adaptation_sustainability: number;
  evidence: string[];
}

export interface GovernanceMomentumProfile {
  organizationId: string;
  momentum_indicators: GovernanceMomentumIndicator;
  overall_momentum_score: number;
  acceleration_trend: 'accelerating' | 'steady' | 'decelerating' | 'volatile';
  sustainability_rating: 'high' | 'moderate' | 'low';
  momentum_narrative: string;
  interpretationGuidance: string;
  entriesAnalyzed: number;
}
