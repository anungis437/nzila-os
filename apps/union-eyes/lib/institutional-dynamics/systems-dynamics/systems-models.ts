/**
 * Institutional Systems Dynamics Models
 * 
 * Models organizations as evolving institutional systems.
 * Tracks governance flow, continuity momentum, coordination friction,
 * institutional inertia, adaptation resistance, and resilience acceleration.
 * 
 * Organizational systems cognition — NOT employee-level analytics.
 */

export type GovernanceFlowPattern =
  | 'linear_progression'
  | 'cyclical_renewal'
  | 'fragmented_channels'
  | 'blocked_flow'
  | 'accelerating_momentum'
  | 'stalled_governance';

export type CoordinationFrictionalArea =
  | 'governance_operational_overlap'
  | 'continuity_resilience_sync'
  | 'procedural_operational_alignment'
  | 'trust_execution_gap'
  | 'memory_decision_linkage'
  | 'coordination_bottleneck';

export type InstitutionalInertiaSource =
  | 'procedural_rigidity'
  | 'governance_resistance'
  | 'organizational_memory_lag'
  | 'trust_deficit'
  | 'coordination_complexity'
  | 'cultural_inertia';

export type AdaptationResistanceSignal =
  | 'slow_mitigation_response'
  | 'governance_reluctance'
  | 'continuity_avoidance'
  | 'precedent_rigidity'
  | 'coordination_delay'
  | 'resilience_hesitation';

export interface GovernanceFlow {
  pattern: GovernanceFlowPattern;
  velocity: number; // 0-100, measures speed of governance flow
  consistency: number; // 0-100, measure of regular flow vs. bursts
  blockages: CoordinationFrictionalArea[];
  evidence: string[];
}

export interface ContinuityMomentum {
  velocity: number; // 0-100, speed of continuity initiatives
  direction: 'accelerating' | 'steady' | 'decelerating' | 'volatile' | 'stalled';
  consistency: number; // 0-100, predictability of momentum
  sustainabilityRisk: 'high' | 'moderate' | 'low' | 'insufficient_data';
  evidence: string[];
}

export interface CoordinationFriction {
  frictionArea: CoordinationFrictionalArea;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  affectedDomains: ('continuity' | 'governance' | 'operational' | 'procedural' | 'resilience')[];
  frequency: number; // 0-100, how often friction occurs
  evidence: string[];
  recommendation: string;
}

export interface InstitutionalInertia {
  inertiaSource: InstitutionalInertiaSource;
  strength: number; // 0-100, resistance to change
  mitigationReadiness: number; // 0-100, org's ability to overcome inertia
  historicalContext: string; // Why this inertia exists
  evidence: string[];
}

export interface ResilienceAcceleration {
  trajectory: 'accelerating' | 'maintaining' | 'decelerating' | 'volatile' | 'insufficient_history';
  velocity: number; // 0-100, speed of resilience improvement
  sustainedPeriods: number; // months of sustained acceleration
  interruptionRisk: 'high' | 'moderate' | 'low';
  evidence: string[];
}

export interface GovernanceStabilizationVelocity {
  velocity: number; // 0-100, speed at which governance stabilizes
  recoveryPattern: 'swift_recovery' | 'gradual_stabilization' | 'prolonged_volatility' | 'insufficient_data';
  averageRecoveryDays: number;
  volatilityTrend: 'improving' | 'stable' | 'worsening';
  evidence: string[];
}

export interface SystemsCoherenceIndicator {
  dimension: 'governance' | 'continuity' | 'coordination' | 'resilience' | 'procedural';
  coherenceScore: number; // 0-100
  pattern: string;
  fragmentationRisk: number; // 0-100
  evidence: string[];
}

export interface InstitutionalStabilitySignal {
  signalType:
    | 'governance_stability'
    | 'continuity_momentum'
    | 'coordination_health'
    | 'resilience_trajectory'
    | 'procedural_consistency';
  signal: 'strengthening' | 'stable' | 'weakening' | 'volatile' | 'insufficient_data';
  strength: number; // 0-100
  confidence: number; // 0-100
  evidence: string[];
}

export interface SystemsDynamicsProfile {
  organizationId: string;
  governanceFlow: GovernanceFlow;
  continuityMomentum: ContinuityMomentum;
  coordinationFrictions: CoordinationFriction[];
  institutionalInertia: InstitutionalInertia[];
  resilienceAcceleration: ResilienceAcceleration;
  governanceStabilizationVelocity: GovernanceStabilizationVelocity;
  coherenceIndicators: SystemsCoherenceIndicator[];
  stabilitySignals: InstitutionalStabilitySignal[];
  overallSystemsHealth: number; // 0-100
  systemsNarrative: string;
  criticalFrictions: CoordinationFriction[];
  interpretationGuidance: string;
  entriesAnalyzed: number;
}
