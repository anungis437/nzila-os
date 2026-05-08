/**
 * Decision Intelligence Models
 *
 * Data structures for organizational continuity planning decisions.
 * Every recommendation must expose evidence, reasoning chain, and assumptions.
 *
 * FRAMING: This is institutional continuity planning support.
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
  /** Confidence in this observation */
  confidence: 'low' | 'medium' | 'high';
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
  /** Critical gaps requiring attention */
  criticalGaps: string[];
  /** Governance exposure summary */
  governanceExposureSummary: string;
  /** Overall decision framing for organizational leaders */
  executiveSummary: string;
}
