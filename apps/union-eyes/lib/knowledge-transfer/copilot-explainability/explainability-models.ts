/**
 * Copilot Explainability Models
 *
 * Data structures for fully transparent copilot responses.
 * Every copilot response must expose evidence, reasoning, and assumptions.
 *
 * NO opaque AI responses. Every answer is auditable and governance-safe.
 */

export type CopilotConfidence = 'high' | 'medium' | 'low' | 'insufficient_data';

export type CopilotResponseType =
  | 'continuity_analysis'
  | 'fragility_explanation'
  | 'governance_interpretation'
  | 'mitigation_guidance'
  | 'dependency_walkthrough'
  | 'simulation_explanation'
  | 'resilience_guidance'
  | 'what_if_exploration';

export interface EvidenceReference {
  /** What data supports this */
  observation: string;
  /** Quantified data point */
  dataPoint: string;
  /** Source type: interview analysis, graph computation, simulation, forecast */
  sourceType: 'interview_analysis' | 'graph_computation' | 'simulation' | 'forecast' | 'resilience_index';
  confidence: CopilotConfidence;
}

export interface ReasoningLink {
  stepNumber: number;
  reasoning: string;
  conclusion: string;
  assumption: string | null;
}

export interface GovernanceFlag {
  concern: string;
  implication: string;
  severity: 'informational' | 'moderate' | 'significant';
}

export interface CopilotExplainabilityEnvelope {
  /** What data was used to form this response */
  evidenceReferences: EvidenceReference[];
  /** Step-by-step reasoning chain */
  reasoningChain: ReasoningLink[];
  /** Key assumptions made */
  assumptions: string[];
  /** Governance considerations surfaced */
  governanceFlags: GovernanceFlag[];
  /** Overall confidence in the response */
  overallConfidence: CopilotConfidence;
  /** What this response does NOT cover */
  limitations: string[];
  /** How to verify or challenge this response */
  verificationGuidance: string;
}

export interface ExplainableCopilotResponse {
  responseType: CopilotResponseType;
  /** Human-readable answer to the query */
  answer: string;
  /** Concise summary for display */
  summary: string;
  /** Full explainability envelope */
  explainability: CopilotExplainabilityEnvelope;
  /** Suggested follow-up questions */
  followUpSuggestions: string[];
  /** Organizational framing — what action this enables */
  organizationalContext: string;
  generatedAt: string;
}
