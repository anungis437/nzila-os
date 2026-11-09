/**
 * Decision Intelligence Models
 *
 * Data structures for organizational continuity planning decisions.
 * Every recommendation must expose evidence, reasoning chain, and assumptions.
 *
 * FRAMING: This is organizational continuity planning support.
 * Never: workforce optimization, employee evaluation, or labor analytics.
 */

export type DecisionCategory =
  | 'mitigation_priority'
  | 'governance_stabilization'
  | 'redundancy_investment'
  | 'documentation_investment'
  | 'vendor_resilience'
  | 'knowledge_transfer';

export type UrgencyLevel = 'immediate' | 'near_term' | 'strategic' | 'aspirational';
export type ImpactMagnitude = 'marginal' | 'moderate' | 'significant' | 'transformative';

export interface EvidenceItem {
  /** What was observed in the organizational data */
  observation: string;
  /** Quantitative support (e.g. "7 of 12 governance nodes are single-source") */
  dataPoint: string;
  /** How much evidence (node/signal count) backs this observation - a volume measure, not a claim that the
   *  observation is correct or independently verified. See lib/knowledge-transfer/governance/evidence-basis.ts. */
  evidenceCoverage: 'low' | 'medium' | 'high';
}

export interface ReasoningStep {
  /** Step number in the reasoning chain */
  step: number;
  /** What was evaluated at this step */
  evaluation: string;
  /** What was concluded */
  conclusion: string;
  /** What assumptions underpin this step */
  assumption: string;
}

export interface ContinuityRecommendation {
  /** Unique identifier */
  id: string;
  /** Decision category */
  category: DecisionCategory;
  /** How urgent is this recommendation */
  urgency: UrgencyLevel;
  /** How significant is the impact */
  impact: ImpactMagnitude;
  /** Short headline recommendation */
  headline: string;
  /** Full rationale */
  rationale: string;
  /** Evidence supporting this recommendation */
  evidence: EvidenceItem[];
  /** Transparent reasoning chain */
  reasoningChain: ReasoningStep[];
  /** Key assumptions the recommendation depends on */
  keyAssumptions: string[];
  /** Governance implications */
  governanceImplications: string[];
  /** Continuity logic (how this affects organizational continuity) */
  continuityLogic: string;
  /** Potential downsides or tradeoffs */
  tradeoffs: string[];
  /** Estimated continuity improvement if implemented (0-30 points) */
  estimatedResilienceGain: number;
}

/**
 * A dependency risk backed by verified evidence (lib/knowledge-transfer/propagation/verified-dependency-store.ts),
 * never by the exploratory propagation map alone. Distinct from criticalGaps, which may still report
 * exploratory-only, pattern-based observations worth investigating.
 */
export interface ConfirmedDependencyRisk {
  dependentNodeId: string;
  dependentLabel: string;
  dependsOnNodeId: string;
  dependsOnLabel: string;
  processOrSystem: string;
  responsibleAuthority: string;
  evidenceReference: string;
  verifiedAt: string;
}

export interface DecisionBrief {
  organizationId: string;
  generatedAt: string;
  /** Current organizational continuity health summary */
  currentStateAssessment: string;
  /** Overall continuity score at time of generation */
  continuityScore: number;
  /** Prioritized recommendations, ordered by urgency then impact */
  recommendations: ContinuityRecommendation[];
  /** Highest-impact single action available */
  topPriority: ContinuityRecommendation | null;
  /** What the organization does well (acknowledge strengths) */
  continuityStrengths: string[];
  /** Critical gaps requiring attention — exploratory, pattern-based observations to investigate, not confirmed findings */
  criticalGaps: string[];
  /**
   * Dependency risks backed by verified evidence. Always [] when confirmedDependencyRiskStatus is
   * 'no_verified_dependency_evidence_recorded' — callers must read that status, not treat an empty array here as
   * "no risk exists"; it means no dependency has been verified yet, which is a different fact.
   */
  confirmedDependencyRisks: ConfirmedDependencyRisk[];
  /**
   * Explicit, type-level status for the confirmed-dependency-risk check. 'no_verified_dependency_evidence_recorded'
   * must never be silently treated as "low risk" — it means verification has not happened, not that dependencies
   * are safe.
   */
  confirmedDependencyRiskStatus: 'no_verified_dependency_evidence_recorded' | 'verified_dependency_evidence_available';
  /** Governance exposure summary */
  governanceExposureSummary: string;
  /** Overall decision framing for organizational leaders */
  executiveSummary: string;
}
