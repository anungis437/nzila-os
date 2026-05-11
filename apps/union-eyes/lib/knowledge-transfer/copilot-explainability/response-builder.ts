/**
 * Copilot Response Builder
 *
 * Constructs fully transparent, explainable copilot responses.
 * Enforces evidence-first, reasoning-visible output structure.
 *
 * No opaque AI answers — every response is auditable.
 */

import {
  type CopilotExplainabilityEnvelope,
  type ExplainableCopilotResponse,
  type CopilotResponseType,
  type EvidenceReference,
  type ReasoningLink,
  type GovernanceFlag,
  type CopilotConfidence,
} from './explainability-models';

/**
 * Assess overall confidence from a set of evidence references.
 */
export function assessConfidence(evidence: EvidenceReference[]): CopilotConfidence {
  if (evidence.length === 0) return 'insufficient_data';
  const highCount = evidence.filter((e) => e.confidence === 'high').length;
  const mediumCount = evidence.filter((e) => e.confidence === 'medium').length;
  const ratio = (highCount + mediumCount * 0.5) / evidence.length;
  if (ratio >= 0.8) return 'high';
  if (ratio >= 0.5) return 'medium';
  if (ratio >= 0.2) return 'low';
  return 'insufficient_data';
}

/**
 * Build an explainability envelope from components.
 */
export function buildExplainabilityEnvelope(
  evidence: EvidenceReference[],
  reasoningChain: ReasoningLink[],
  assumptions: string[],
  governanceFlags: GovernanceFlag[],
  limitations: string[],
  verificationGuidance: string,
): CopilotExplainabilityEnvelope {
  return {
    evidenceReferences: evidence,
    reasoningChain,
    assumptions,
    governanceFlags,
    overallConfidence: assessConfidence(evidence),
    limitations,
    verificationGuidance,
  };
}

/**
 * Wrap an AI-generated answer with full explainability.
 */
export function buildExplainableResponse(
  responseType: CopilotResponseType,
  answer: string,
  summary: string,
  explainability: CopilotExplainabilityEnvelope,
  followUpSuggestions: string[],
  organizationalContext: string,
): ExplainableCopilotResponse {
  return {
    responseType,
    answer,
    summary,
    explainability,
    followUpSuggestions,
    organizationalContext,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Build standard evidence references from propagation map data.
 */
export function buildPropagationEvidence(
  singleSourceCount: number,
  totalNodes: number,
  bottleneckCount: number,
): EvidenceReference[] {
  const references: EvidenceReference[] = [];
  if (totalNodes > 0) {
    references.push({
      observation: `${singleSourceCount} of ${totalNodes} knowledge areas have single-source coverage`,
      dataPoint: `${Math.round((singleSourceCount / totalNodes) * 100)}% single-source concentration`,
      sourceType: 'graph_computation',
      confidence: 'high',
    });
  }
  if (bottleneckCount > 0) {
    references.push({
      observation: `${bottleneckCount} operational bottlenecks identified in dependency graph`,
      dataPoint: `${bottleneckCount} bottleneck nodes`,
      sourceType: 'graph_computation',
      confidence: 'high',
    });
  }
  return references;
}

/**
 * Build standard governance flags from governance concentration data.
 */
export function buildGovernanceFlags(
  govSingleSourceCount: number,
  totalGovNodes: number,
): GovernanceFlag[] {
  const flags: GovernanceFlag[] = [];
  if (govSingleSourceCount === 0) return flags;
  const pct = Math.round((govSingleSourceCount / Math.max(totalGovNodes, 1)) * 100);
  flags.push({
    concern: `${govSingleSourceCount} governance processes have single-source knowledge coverage (${pct}%)`,
    implication: 'Regulatory and compliance continuity may be at risk if these knowledge areas become unavailable',
    severity: pct >= 60 ? 'significant' : pct >= 30 ? 'moderate' : 'informational',
  });
  return flags;
}
