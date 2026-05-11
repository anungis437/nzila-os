/**
 * Governance Coherence Intelligence Models
 * 
 * Evaluates how coherently governance systems operate together.
 * Measures procedural consistency, governance fragmentation, policy alignment,
 * continuity synchronization, operational governance overlap, and coordination breakdowns.
 */

export type GovernanceCoherenceDimension =
  | 'procedural_consistency'
  | 'governance_fragmentation'
  | 'policy_alignment'
  | 'continuity_synchronization'
  | 'operational_governance_overlap'
  | 'coordination_breakdowns';

export interface ProceduralConsistencyIndicator {
  consistency: number; // 0-100
  uniformityAcrossDomains: number; // 0-100, how consistent are procedures?
  variationPattern: 'uniform' | 'gradually_varying' | 'highly_variable' | 'fragmented';
  evidence: string[];
}

export interface GovernanceFragmentationIndicator {
  fragmentationLevel: number; // 0-100, higher = more fragmented
  siloCount: number; // estimated number of governance silos
  communicationBreakpoints: number; // where does communication break down?
  crossSiloCoordination: number; // 0-100, how well do silos talk?
  evidence: string[];
}

export interface PolicyAlignmentIndicator {
  alignmentScore: number; // 0-100
  conflictingPolicies: string[]; // policies that conflict
  gapAreas: string[]; // areas with policy gaps
  alignmentTrend: 'improving' | 'stable' | 'degrading';
  evidence: string[];
}

export interface ContinuitySynchronizationIndicator {
  synchronization: number; // 0-100
  timingConsistency: number; // 0-100, do continuity efforts align temporally?
  dependencyAlignment: number; // 0-100, are dependencies tracked?
  reciprocalSupport: number; // 0-100, do initiatives support each other?
  evidence: string[];
}

export interface OperationalGovernanceOverlapIndicator {
  overlapScore: number; // 0-100
  ambiguousAuthority: number; // 0-100, where is authority unclear?
  decisionDelays: number; // 0-100, frequency of governance delays
  duplicationLevel: number; // 0-100, redundant oversight
  evidence: string[];
}

export interface CoordinationBreakdownIndicator {
  breakdownFactor: string;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  affectedDomains: string[];
  frequency: number; // 0-100, how often?
  recoveryTime: number; // average days to recover
  evidence: string[];
}

export interface GovernanceCoherenceScore {
  dimension: GovernanceCoherenceDimension;
  score: number; // 0-100
  strength: 'strong' | 'adequate' | 'weak' | 'critical';
  trend: 'improving' | 'stable' | 'degrading' | 'volatile' | 'insufficient_data';
  evidence: string[];
  recommendation: string;
}

export interface FragmentationMap {
  governanceSilos: Array<{
    siloName: string;
    autonomyLevel: number; // 0-100
    integrationPoints: number;
    communicationFrequency: 'high' | 'moderate' | 'low' | 'minimal';
  }>;
  communicationBreakpoints: string[];
  integrationGaps: string[];
}

export interface SynchronizationMap {
  alignedInitiatives: Array<{
    initiatives: string[];
    alignmentQuality: number; // 0-100
    temporalSync: number; // 0-100
  }>;
  misalignedInitiatives: Array<{
    initiatives: string[];
    conflictArea: string;
    severity: 'high' | 'moderate' | 'low';
  }>;
}

export interface GovernanceCoherenceProfile {
  organizationId: string;
  overallCoherenceScore: number; // 0-100
  dimensions: GovernanceCoherenceScore[];
  proceduralConsistency: ProceduralConsistencyIndicator;
  governanceFragmentation: GovernanceFragmentationIndicator;
  policyAlignment: PolicyAlignmentIndicator;
  continuitySynchronization: ContinuitySynchronizationIndicator;
  operationalGovernanceOverlap: OperationalGovernanceOverlapIndicator;
  coordinationBreakdowns: CoordinationBreakdownIndicator[];
  fragmentationMap: FragmentationMap;
  synchronizationMap: SynchronizationMap;
  coherenceNarrative: string;
  criticalCoherenceIssues: GovernanceCoherenceScore[];
  interpretationGuidance: string;
  entriesAnalyzed: number;
}
