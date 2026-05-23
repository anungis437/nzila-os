/**
 * Organizational Response Elasticity Models
 */

export interface ResponseElasticityIndicator {
  resilience_responsiveness: number; // 0-100
  mitigation_adaptation_speed: number; // 0-100
  governance_recovery_elasticity: number; // 0-100
  continuity_stabilization_velocity: number; // 0-100
  institutional_recovery_trajectories: string;
  evidence: string[];
}

export interface OrganizationalResponseElasticityProfile {
  organizationId: string;
  elasticity_indicators: ResponseElasticityIndicator;
  adaptability_score: number; // 0-100
  recovery_curve: string;
  stress_response_pattern: 'fast' | 'moderate' | 'slow' | 'oscillating';
  sustainability: 'high' | 'moderate' | 'low';
  interpretationGuidance: string;
  entriesAnalyzed: number;
}
