/**
 * Organizational Graph Query Models
 *
 * Query interface for explainable organizational reasoning.
 * Enables natural questions about organizational dependencies, fragility, and risk.
 */

export type QueryType =
  | 'isolated_knowledge'
  | 'continuity_bottlenecks'
  | 'governance_dependencies'
  | 'fragile_operations'
  | 'vendor_concentration'
  | 'undocumented_chains'
  | 'propagation_paths'
  | 'resilience_weaknesses'
  | 'knowledge_redundancy';

export interface GraphQuery {
  organizationId: string;
  queryType: QueryType;
  /** Optional filters */
  filters?: {
    category?: string;
    minimumRiskLevel?: 'low' | 'medium' | 'high' | 'critical';
    roleFilter?: string;
    depthLimit?: number;
  };
  /** Explanation level: brief | detailed | exhaustive */
  explanationLevel: 'brief' | 'detailed' | 'exhaustive';
}

export interface QueryResult {
  organizationId: string;
  executedAt: string;
  query: GraphQuery;
  /** Human-readable interpretation of what was found */
  summary: string;
  /** Core findings */
  findings: QueryFinding[];
  /** Why these results matter */
  significance: string;
  /** Recommended follow-up actions */
  recommendations: string[];
  /** Confidence in findings (0-100) */
  confidenceScore: number;
}

export interface QueryFinding {
  /** ID of the finding (node or edge) */
  entityId: string;
  /** Human-readable name */
  label: string;
  /** Type of entity: node | path | cluster */
  entityType: 'node' | 'path' | 'cluster';
  /** Why this is significant in context of the query */
  significance: string;
  /** Risk level if this is exposed */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  /** Roles or domains affected */
  affectedAreas: string[];
  /** Mitigation suggestion */
  mitigation?: string;
  /** Evidence chain explaining why this finding occurred */
  evidenceChain: string[];
}

export interface IsolatedKnowledgeResult extends QueryFinding {
  /** How many interviews mention this knowledge (1 for isolated) */
  mentionCount: 1;
  /** Roles that possess this knowledge */
  experts: string[];
  /** Estimated time to reconstruct if lost (weeks) */
  reconstructionTimeWeeks: number;
}

export interface ContinuityBottleneckResult extends QueryFinding {
  /** Number of dependent processes */
  dependentCount: number;
  /** Direct dependents */
  directDependents: string[];
  /** Transitive dependents */
  transitiveImpact: number; // count of all affected nodes
  /** Single point of failure? */
  isCriticalPath: boolean;
}

export interface GovernanceDependencyResult extends QueryFinding {
  /** Governance bodies affected */
  governanceBodies: string[];
  /** Regulatory obligations at risk */
  regulatoryObligations: string[];
  /** Compliance gap if exposed */
  complianceGap: string;
}

export interface VendorConcentrationResult extends QueryFinding {
  /** Vendor(s) involved */
  vendors: string[];
  /** Number of internal processes dependent on this vendor */
  dependencyCount: number;
  /** Alternative vendors available? */
  hasAlternatives: boolean;
  /** Switching cost estimate: low | medium | high | extreme */
  switchingCost: 'low' | 'medium' | 'high' | 'extreme';
}

export interface UndocumentedChainResult {
  chainId: string;
  /** Sequence of undocumented processes/workflows */
  chain: Array<{ nodeId: string; label: string; isDocumented: boolean }>;
  /** Total length of chain */
  length: number;
  /** Roles that understand this chain */
  carryingRoles: string[];
  /** Overall risk if this chain is lost */
  chainRisk: 'medium' | 'high' | 'critical';
  /** Suggested mitigation */
  mitigation: string;
}

export interface PropagationPathResult {
  pathId: string;
  /** Start node */
  origin: { id: string; label: string };
  /** End node */
  destination: { id: string; label: string };
  /** Intermediate nodes in path */
  intermediates: Array<{ id: string; label: string }>;
  /** Why this path matters */
  significance: string;
  /** If origin is lost, impact at destination */
  impactAtDestination: 'low' | 'medium' | 'high' | 'critical';
  /** Recovery options */
  recoveryOptions: string[];
}

export interface ResilienceWeaknessResult extends QueryFinding {
  weaknessType: 'single_source' | 'clustering' | 'external_dependency' | 'governance_gap' | 'redundancy_failure';
  /** How widespread this weakness is */
  scope: 'isolated' | 'local' | 'organizational';
  /** Effort to remediate: low | medium | high | extreme */
  remediationEffort: 'low' | 'medium' | 'high' | 'extreme';
}

export interface KnowledgeRedundancyResult {
  /** Topics/systems with strong redundancy */
  wellCovered: Array<{ name: string; coverageCount: number; riskLevel: 'low' }>;
  /** Topics/systems with weak redundancy */
  atRisk: Array<{ name: string; coverageCount: number; riskLevel: 'medium' | 'high' | 'critical' }>;
  /** Overall organizational redundancy score (0-100) */
  redundancyScore: number;
}
