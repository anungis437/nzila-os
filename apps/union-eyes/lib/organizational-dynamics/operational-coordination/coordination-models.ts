/**
 * Operational Coordination Modeling
 * 
 * Models organizational coordination behavior and efficiency.
 */

export type CoordinationBottleneck = 'governance_authorization' | 'information_flow' | 'stakeholder_availability' | 'decision_velocity' | 'procedural_handoff';

export interface CoordinationEfficiencyIndicator {
  efficiency: number; // 0-100
  responseLatency: number; // average days to response
  synchronizationQuality: number; // 0-100
  dependencyTracking: number; // 0-100, how well are dependencies tracked?
  evidence: string[];
}

export interface OperationalSynchronizationMap {
  governanceResponseTime: number; // days
  continuityResponseTime: number; // days
  mitigationResponseTime: number; // days
  maxResponseTime: number; // days
  synchronizationScore: number; // 0-100
  evidence: string[];
}

export interface CoordinationTrajectory {
  efficiency: number; // 0-100
  trend: 'improving' | 'stable' | 'degrading' | 'volatile' | 'insufficient_data';
  coordinationMomentum: number; // 0-100
  sustainability: 'high' | 'moderate' | 'low';
  evidence: string[];
}

export interface OperationalCoordinationProfile {
  organizationId: string;
  overallCoordinationScore: number; // 0-100
  bottlenecks: Array<{
    bottleneck: CoordinationBottleneck;
    severity: 'critical' | 'high' | 'moderate' | 'low';
    frequency: number; // 0-100
    impactedInteractions: number;
    evidence: string[];
  }>;
  efficiencyIndicators: CoordinationEfficiencyIndicator[];
  synchronizationMap: OperationalSynchronizationMap;
  trajectory: CoordinationTrajectory;
  coordinationNarrative: string;
  interpretationGuidance: string;
  entriesAnalyzed: number;
}
