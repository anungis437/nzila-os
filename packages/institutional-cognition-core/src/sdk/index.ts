/**
 * Cognition SDK
 *
 * Convenience helpers for building well-formed cognition engines on top of
 * the kernel without re-implementing boilerplate.
 */

import type { CognitionDomain, ConfidenceBand } from '../ontology/index.js';
import { confidenceBandFromScore } from '../ontology/index.js';
import {
  buildExplainabilityEnvelope,
  type InstitutionalExplainabilityEnvelope,
  type EvidenceItem,
  type ReasoningStep,
  type ContinuityAssumption,
  type GovernanceImplication,
} from '../explainability/index.js';
import { assertLaborSafe } from '../governance/index.js';
import { COGNITION_CONTRACT_VERSION } from '../contracts/index.js';

export interface CognitionEngineDefinition<TPayload> {
  engineId: string;
  engineVersion: string;
  domain: CognitionDomain;
  /** Computes the domain-specific cognition payload. */
  compute: (organizationId: string) => Promise<{
    payload: TPayload;
    confidenceScore: number; // 0-100
    evidence?: EvidenceItem[];
    reasoning?: ReasoningStep[];
    assumptions?: ContinuityAssumption[];
    governanceImplications?: GovernanceImplication[];
    interpretationGuidance: string;
  }>;
}

/**
 * Wrap a domain compute function into a fully-governed, explainable engine.
 * The returned function is what gets registered in the cognition registry
 * and what API routes / orchestrators invoke.
 */
export function defineCognitionEngine<TPayload>(
  def: CognitionEngineDefinition<TPayload>,
): (organizationId: string) => Promise<InstitutionalExplainabilityEnvelope<TPayload>> {
  return async (organizationId: string) => {
    assertLaborSafe({
      organizationId,
      domain: def.domain,
      scopeOfObservation: 'organizational',
    });
    const result = await def.compute(organizationId);
    const confidence: ConfidenceBand = confidenceBandFromScore(result.confidenceScore);
    return buildExplainabilityEnvelope({
      organizationId,
      domain: def.domain,
      payload: result.payload,
      confidence,
      evidence: result.evidence,
      reasoning: result.reasoning,
      assumptions: result.assumptions,
      governanceImplications: result.governanceImplications,
      engine: def.engineId,
      engineVersion: def.engineVersion,
      contractVersion: COGNITION_CONTRACT_VERSION,
      interpretationGuidance: result.interpretationGuidance,
    });
  };
}
