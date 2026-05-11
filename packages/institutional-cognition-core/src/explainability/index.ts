/**
 * Unified Explainability Protocol
 *
 * Every institutional cognition engine MUST return its result wrapped in
 * (or accompanied by) an InstitutionalExplainabilityEnvelope. This is the
 * single source of truth for cognition transparency, governance review,
 * and human oversight.
 */

import type { CognitionDomain, ConfidenceBand, SeverityLevel } from '../ontology/index';

/**
 * Discrete piece of evidence backing a cognition output.
 * Evidence is always organizational (never personal/employee-level).
 */
export interface EvidenceItem {
  /** Stable identifier suitable for cross-referencing in audit chains. */
  id: string;
  /** Origin domain that produced this evidence. */
  sourceDomain: CognitionDomain;
  /** Human-readable description of the evidence. */
  description: string;
  /** Optional reference to the underlying memory entry / record. */
  reference?: {
    kind: 'cognition_memory' | 'reasoning_session' | 'simulation' | 'forecast' | 'document';
    id: string;
  };
  /** When the supporting record was captured. ISO 8601 string. */
  capturedAt?: string;
}

/**
 * One link in a reasoning chain. Reasoning chains explain HOW a conclusion
 * was reached, not just what the conclusion is.
 */
export interface ReasoningStep {
  step: number;
  domain: CognitionDomain;
  rationale: string;
  evidenceIds: string[];
  confidence: ConfidenceBand;
}

/**
 * Continuity assumption a cognition output depends on.
 * If an assumption breaks, the output must be re-evaluated.
 */
export interface ContinuityAssumption {
  assumption: string;
  domain: CognitionDomain;
  failureMode: string;
}

/**
 * Governance implication of a cognition output. Used by governance copilots
 * and review surfaces to surface the human-decision footprint.
 */
export interface GovernanceImplication {
  domain: CognitionDomain;
  implication: string;
  severity: SeverityLevel;
  requiresHumanReview: boolean;
}

/**
 * Provenance record for the cognition that produced this output.
 */
export interface CognitionProvenance {
  /** The engine that produced the output (e.g. "systems-dynamics@v1"). */
  engine: string;
  /** Engine semantic version. */
  engineVersion: string;
  /** When the cognition ran. ISO 8601. */
  generatedAt: string;
  /** Optional reasoning session id this output belongs to. */
  sessionId?: string;
  /** Optional contract version this engine emits. */
  contractVersion: string;
}

/**
 * MANDATORY envelope. All cognition engines must return one of these
 * alongside (or wrapping) their domain-specific payload.
 */
export interface InstitutionalExplainabilityEnvelope<TPayload = unknown> {
  organizationId: string;
  domain: CognitionDomain;
  /** Domain-specific cognition output. Always organizationally scoped. */
  payload: TPayload;
  /** Confidence band derived from evidence quality and reasoning depth. */
  confidence: ConfidenceBand;
  /** Evidence backing the output. */
  evidence: EvidenceItem[];
  /** Step-by-step reasoning chain. */
  reasoning: ReasoningStep[];
  /** Assumptions the output depends on. */
  assumptions: ContinuityAssumption[];
  /** Governance implications surfaced for human review. */
  governanceImplications: GovernanceImplication[];
  /** Cognition provenance metadata. */
  provenance: CognitionProvenance;
  /** Human-readable interpretation guidance for reviewers. */
  interpretationGuidance: string;
}

/**
 * Builder helper — produces a well-formed envelope from a payload.
 * Engines should prefer this over constructing envelopes manually so the
 * shape stays canonical.
 */
export function buildExplainabilityEnvelope<TPayload>(input: {
  organizationId: string;
  domain: CognitionDomain;
  payload: TPayload;
  confidence: ConfidenceBand;
  evidence?: EvidenceItem[];
  reasoning?: ReasoningStep[];
  assumptions?: ContinuityAssumption[];
  governanceImplications?: GovernanceImplication[];
  engine: string;
  engineVersion: string;
  contractVersion: string;
  sessionId?: string;
  interpretationGuidance: string;
}): InstitutionalExplainabilityEnvelope<TPayload> {
  return {
    organizationId: input.organizationId,
    domain: input.domain,
    payload: input.payload,
    confidence: input.confidence,
    evidence: input.evidence ?? [],
    reasoning: input.reasoning ?? [],
    assumptions: input.assumptions ?? [],
    governanceImplications: input.governanceImplications ?? [],
    provenance: {
      engine: input.engine,
      engineVersion: input.engineVersion,
      generatedAt: new Date().toISOString(),
      sessionId: input.sessionId,
      contractVersion: input.contractVersion,
    },
    interpretationGuidance: input.interpretationGuidance,
  };
}
