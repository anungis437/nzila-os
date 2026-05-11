/**
 * Dependency Propagation Models
 *
 * Data structures for modeling continuity impact propagation through
 * organizational dependency chains.
 *
 * All models remain organizationally scoped — no employee evaluation.
 */

export interface DependencyNode {
  /** Unique identifier for this dependency node */
  id: string;
  /** Human-readable name (e.g., "WSIB claims process", "payroll system") */
  label: string;
  /** 'expertise' | 'system' | 'vendor' | 'governance' | 'procedure' */
  nodeType: 'expertise' | 'system' | 'vendor' | 'governance' | 'procedure';
  /** Category for visualization (system, vendor, governance, compliance, operational, general) */
  category: string;
  /** How many roles/interviews contributed to this knowledge */
  frequency: number;
  /** Roles that possess or contributed this knowledge */
  associatedRoles: string[];
  /** If true, this knowledge comes from a single source */
  isSingleSource: boolean;
  /** Continuity risk if this knowledge is lost: low | medium | high | critical */
  continuitySensitivity: 'low' | 'medium' | 'high' | 'critical';
  /** Human-readable justification for the sensitivity rating */
  sensitivityReason: string;
}

export interface DependencyEdge {
  /** ID of the node that depends on the knowledge/system */
  dependentId: string;
  /** ID of the node being depended upon */
  dependsOnId: string;
  /** Strength of dependency: how much the dependent relies on the dependency */
  strength: 'weak' | 'medium' | 'strong' | 'critical';
  /** How many interviews reference this relationship */
  evidenceCount: number;
  /** Human-readable explanation of why this dependency exists */
  rationale: string;
}

export interface PropagationPath {
  /** Starting node (the affected knowledge/system) */
  originId: string;
  /** Sequence of nodes from origin to endpoint */
  chainPath: string[];
  /** Total continuity impact score (0-100) */
  impactScore: number;
  /** Estimated operational disruption scope */
  disruptionScope: 'isolated' | 'local' | 'organizational' | 'critical';
  /** Estimated recovery time if this chain collapses */
  recoveryTimeWeeks: number;
  /** Roles affected by this propagation */
  affectedRoles: string[];
  /** Depth of the propagation chain */
  chainDepth: number;
}

export interface DownstreamImpact {
  /** The knowledge/system being analyzed */
  nodeId: string;
  /** Direct nodes that immediately depend on this */
  directDependents: string[];
  /** All nodes indirectly affected (transitive closure) */
  allAffectedNodes: string[];
  /** Propagation paths showing impact chains */
  propagationPaths: PropagationPath[];
  /** Overall continuity exposure from losing this knowledge */
  totalExposureScore: number;
  /** Governance/compliance areas affected */
  governanceExposure: string[];
  /** Vendor relationships affected */
  vendorDependencyExposure: string[];
  /** Recommended resilience mitigations */
  mitigation: {
    priority: 'critical' | 'high' | 'medium' | 'low';
    actions: string[];
  };
}

export interface UpstreamDependencies {
  /** The knowledge/system being analyzed */
  nodeId: string;
  /** Immediate dependencies (what this node requires) */
  directDependencies: string[];
  /** All transitive dependencies */
  allRequiredDependencies: string[];
  /** How fragile these dependencies are (concentration, single-source risk) */
  dependencyFragility: 'low' | 'medium' | 'high' | 'critical';
  /** Which dependencies are single-source */
  singleSourceDependencies: string[];
  /** Total operational complexity to maintain this knowledge */
  complexityScore: number; // 0-100
}

export interface OperationalCouplingAnalysis {
  /** The primary knowledge/system being analyzed */
  nodeId: string;
  /** Nodes that are tightly coupled (high co-occurrence, frequent interaction) */
  tightlyCoupledNodes: Array<{ nodeId: string; couplingStrength: number }>;
  /** Nodes that are loosely coupled */
  looselyCoupledNodes: Array<{ nodeId: string; couplingStrength: number }>;
  /** If removed, what would break immediately */
  criticalDependents: string[];
  /** How isolated this knowledge is (0-100, higher = more isolated) */
  isolationScore: number;
  /** Operational cohesion score: how well integrated with the rest of the org */
  cohesionScore: number;
}

export interface PropagationMap {
  organizationId: string;
  generatedAt: string;
  /** Nodes in the dependency graph */
  nodes: DependencyNode[];
  /** Edges in the dependency graph */
  edges: DependencyEdge[];
  /** Downstream analysis for key nodes */
  downstreamImpacts: DownstreamImpact[];
  /** Upstream analysis for key nodes */
  upstreamDependencies: UpstreamDependencies[];
  /** Coupling analysis for critical nodes */
  couplingAnalysis: OperationalCouplingAnalysis[];
  /** High-risk bottlenecks identified */
  bottlenecks: Array<{
    nodeId: string;
    reason: 'single_source' | 'high_dependents' | 'critical_vendor' | 'governance_concentration';
    riskLevel: 'high' | 'critical';
    affectedRoles: string[];
  }>;
  /** Recommendations for resilience improvement */
  resilience: {
    recommendations: string[];
    priorityOrder: string[];
    estimatedEffort: Record<string, 'low' | 'medium' | 'high'>;
  };
}

/**
 * Compute continuity impact score based on:
 * - Node frequency (how many sources)
 * - Number of dependents
 * - Sensitivity of dependents
 * - Governance criticality
 */
export function computeImpactScore(
  frequency: number,
  dependentCount: number,
  dependentSensitivities: string[],
  isGovernanceCritical: boolean,
): number {
  let score = 0;

  // Single-source multiplier: dramatic increase in risk
  if (frequency === 1) {
    score += 60;
  } else if (frequency === 2) {
    score += 30;
  } else if (frequency <= 4) {
    score += 15;
  }

  // Dependent count: each additional dependent adds risk
  score += Math.min(dependentCount * 10, 25);

  // Sensitivity of dependents: critical dependents amplify impact
  const criticalDependents = dependentSensitivities.filter((s) => s === 'critical').length;
  const highDependents = dependentSensitivities.filter((s) => s === 'high').length;
  score += criticalDependents * 10 + highDependents * 5;

  // Governance criticality: governance failures have outsized impact
  if (isGovernanceCritical) {
    score += 15;
  }

  return Math.min(score, 100);
}

/**
 * Estimate recovery time in weeks based on:
 * - Chain depth
 * - Vendor involvement
 * - Governance requirements
 * - Documentation quality
 */
export function estimateRecoveryTime(
  chainDepth: number,
  hasVendorDependencies: boolean,
  isGovernanceRelated: boolean,
  documentationQuality: 'minimal' | 'partial' | 'good',
): number {
  let weeks = 0;

  // Chain depth: each level adds 1-2 weeks
  weeks += chainDepth * 1.5;

  // Vendor involvement: adds 2-4 weeks (external coordination)
  if (hasVendorDependencies) {
    weeks += 3;
  }

  // Governance requirements: adds 1-3 weeks (compliance process)
  if (isGovernanceRelated) {
    weeks += 2;
  }

  // Documentation quality: affects recovery speed significantly
  if (documentationQuality === 'minimal') {
    weeks *= 1.8; // 80% increase
  } else if (documentationQuality === 'partial') {
    weeks *= 1.3; // 30% increase
  }

  return Math.ceil(weeks);
}
