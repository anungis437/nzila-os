/**
 * Organizational Graph Query Models
 *
 * Query interface for explainable organizational reasoning.
 * Enables natural questions about organizational dependencies, fragility, and risk.
 */

import type { EvidenceBasis, ConfirmedEdge } from '../propagation/graph-evidence-service';

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
  findings: Array<QueryFinding & {
    /** 'verified' only for a dependency-path finding every directed edge of whose dependencyChain is currently
     *  verified. A finding about a node (isolation, bottleneck, sensitivity, concentration) is always 'exploratory':
     *  dependency evidence confirms relationships, never a node's inferred properties (DEF-0B7-COGB-PROPAGATION-
     *  DEPENDENCIES-AND-SENSITIVITY-INFERRED-FROM-TAG-CO-OCCURRENCE). */
    evidenceBasis: EvidenceBasis;
    /** For a 'verified' finding: the verified record behind each edge and its evidence tier. */
    verifiedBy?: ConfirmedEdge[];
  }>;
  /** The SUBSET of findings whose asserted dependency chain is fully verified - the only entries an API response,
   *  calculation or UI may present as a CONFIRMED organizational fact. An evidenceBasis tag on findings alone is
   *  not sufficient when a caller's business metric or claim presents a result as verified operational risk; this
   *  pre-filtered view is what that caller must use instead of filtering findings by tag itself. Every entry here
   *  also appears in findings. */
  confirmedFindings: QueryResult['findings'];
  /** Why these results matter */
  significance: string;
  /** Recommended follow-up actions */
  recommendations: string[];
  /**
   * How much interview evidence backs these findings (0-100) - a volume measure of how many interviews
   * contributed, never a claim that the findings themselves are statistically validated or confirmed
   * (DEF-0B7-COGA-RISK-RATINGS-ARE-FIXED-RULES-OVER-TAG-COUNTS: evidence coverage must come from how many
   * records underlie the claim, not a formula that also rewards finding more issues as if that made the
   * analysis itself more certain).
   */
  evidenceCoverageScore: number;
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
  /** For a dependency-path finding: the impact chain it asserts (origin first; each next node depends on the
   *  previous one). Only a finding that asserts such a chain can ever be confirmed - see graph-reasoner.ts. */
  dependencyChain?: string[];
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
