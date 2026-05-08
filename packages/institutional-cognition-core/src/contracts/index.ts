/**
 * Canonical Cognition Contracts
 *
 * The single, authoritative shape for cognition primitives across all UE
 * domains. T1–T9 systems migrate to these. NO local cognition types.
 */

import type {
  CognitionDomain,
  ConfidenceBand,
  InstitutionalConcept,
  MaturityLevel,
  SeverityLevel,
  TrajectoryLabel,
} from '../ontology/index.js';
import type {
  EvidenceItem,
  InstitutionalExplainabilityEnvelope,
} from '../explainability/index.js';

/** Current canonical contract version emitted by engines. */
export const COGNITION_CONTRACT_VERSION = '1.0.0';

/**
 * A reasoning session is the unit of cognition orchestration.
 * Sessions are organizationally-scoped, auditable, and explainable.
 */
export interface CognitionSession {
  id: string;
  organizationId: string;
  startedAt: string;
  closedAt?: string;
  participatingDomains: CognitionDomain[];
  topic: string;
  status: 'open' | 'closed' | 'archived';
}

/**
 * A reasoning chain is the structured derivation of an insight from evidence.
 */
export interface ReasoningChain {
  id: string;
  sessionId?: string;
  organizationId: string;
  insight: string;
  domains: CognitionDomain[];
  confidence: ConfidenceBand;
  evidence: EvidenceItem[];
  steps: Array<{ stepNumber: number; rationale: string; domain: CognitionDomain }>;
}

/**
 * Output of a continuity / propagation / mitigation simulation.
 */
export interface SimulationOutput<TScenario = unknown, TOutcome = unknown> {
  id: string;
  organizationId: string;
  scenario: TScenario;
  outcome: TOutcome;
  confidence: ConfidenceBand;
  /** Resilience score impact, 0-100 delta. */
  resilienceDelta?: number;
  evidence: EvidenceItem[];
  generatedAt: string;
}

/**
 * A continuity forecast over a future window.
 */
export interface ContinuityForecast {
  organizationId: string;
  horizonDays: number;
  predictedResilience: number; // 0-100
  predictedTrajectory: TrajectoryLabel;
  riskAreas: Array<{ concept: InstitutionalConcept; severity: SeverityLevel }>;
  confidence: ConfidenceBand;
  evidence: EvidenceItem[];
}

/**
 * Governance insight surfaced by a copilot or governance engine.
 */
export interface GovernanceInsight {
  organizationId: string;
  domain: CognitionDomain;
  insight: string;
  severity: SeverityLevel;
  requiresHumanReview: boolean;
  evidence: EvidenceItem[];
}

/**
 * A single canonical cognition memory entry. Domain-engines that read or
 * write longitudinal memory must use this shape.
 */
export interface InstitutionalMemoryEntry {
  id: string;
  organizationId: string;
  concept: InstitutionalConcept;
  title: string;
  capturedAt: string;
  /** Optional resilience score captured at this moment. */
  resilienceScoreAtCapture?: number | null;
  /** Optional reasoning session that produced this entry. */
  sessionId?: string | null;
  tags: string[];
}

/**
 * Output of a propagation analysis (cascade / dependency reasoning).
 */
export interface PropagationAnalysis {
  organizationId: string;
  rootConcept: InstitutionalConcept;
  affectedDomains: CognitionDomain[];
  cascadeDepth: number;
  severity: SeverityLevel;
  evidence: EvidenceItem[];
}

/**
 * Resilience model output — composite organizational resilience picture.
 */
export interface ResilienceModel {
  organizationId: string;
  overallScore: number; // 0-100
  byDomain: Array<{ domain: CognitionDomain; score: number; maturity: MaturityLevel }>;
  trajectory: TrajectoryLabel;
  evidence: EvidenceItem[];
}

/**
 * A precedent reasoning record — historical institutional patterns linked
 * to current decisions.
 */
export interface PrecedentReasoning {
  organizationId: string;
  precedentTitle: string;
  similarity: number; // 0-100
  appliedTo: InstitutionalConcept;
  evidence: EvidenceItem[];
}

/**
 * Adaptation learning event — how the institution's cognition evolved.
 */
export interface AdaptationLearning {
  organizationId: string;
  beforeState: string;
  afterState: string;
  triggerEvent: string;
  evidence: EvidenceItem[];
}

/* -------------------------------------------------------------------------- */
/* Convenience aliases                                                          */
/* -------------------------------------------------------------------------- */

/** A cognition output already wrapped in the canonical envelope. */
export type CognitionResult<T> = InstitutionalExplainabilityEnvelope<T>;
