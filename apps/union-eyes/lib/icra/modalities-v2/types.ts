/**
 * ARTIFACT TYPE: v2 Modality Type System
 * DOCTRINE_VERSION: 1.2.0-foundation
 * CANONICAL DOCTRINE: docs/oci/audit/QUESTION_POOL_v2_0_ROADMAP.md
 *
 * Strict typed definitions for the eight new OCRA/OCI response modalities
 * introduced by the Signal Sophistication Recovery Sprint.
 *
 * Each modality is defined as a discriminated record carrying explicit
 * signal-extraction semantics. The modalities are intentionally NOT folded
 * into the legacy `Question` union in this commit — adoption is staged
 * per QUESTION_POOL_v2_0_ROADMAP.md so the scoring engine, narrative
 * engine, and UI layer migrate without regression.
 *
 * Anti-claims preserved:
 *   - No modality probes individuals.
 *   - No modality requests names of staff, leaders, or members.
 *   - No modality infers political, behavioural, or productivity signals.
 *   - Every modality maps to declared institutional structure only.
 */

import type {
  DimensionWeights,
  IntelligenceContribution,
  LongitudinalValue,
  ModalityRole,
  SectionId,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Modality identifiers
// ─────────────────────────────────────────────────────────────────────────────

export type V2ModalityId =
  | 'contradiction_pair'
  | 'evidence_strength'
  | 'continuity_distribution'
  | 'dependency_mapping'
  | 'confidence_marker'
  | 'topology_mapping'
  | 'stability_marker'
  | 'transition_exposure';

// ─────────────────────────────────────────────────────────────────────────────
// Shared base — every v2 modality declares these fields
// ─────────────────────────────────────────────────────────────────────────────

export interface V2QuestionBase {
  id: string;
  modality: V2ModalityId;
  section: SectionId;
  prompt: string;
  helpText?: string;
  rationale: string;
  weights: DimensionWeights;
  riskInverted?: boolean;
  intelligence: {
    modalityRole: ModalityRole;
    intelligenceContribution: IntelligenceContribution[];
    longitudinalValue: LongitudinalValue;
    confidenceSensitivity: boolean;
    governanceSensitivity: boolean;
    /**
     * Adaptive routing fingerprint — declared topology dimensions this
     * question deepens. Consumed by routing-v2/pathTypes.ts.
     */
    deepens: Array<
      | 'governance_fragility'
      | 'modernization_fragility'
      | 'continuity_dependency'
      | 'federated_governance'
      | 'onboarding_survivability'
      | 'contradiction_resolution'
      | 'confidence_escalation'
    >;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. contradiction_pair — paired signals that, when both affirmed, reveal
//    a structural contradiction (e.g., "documented onboarding" vs
//    "successors operate independently within 30 days"). Surfaces
//    declared-vs-evidenced gaps.
// ─────────────────────────────────────────────────────────────────────────────

export interface ContradictionPairQuestion extends V2QuestionBase {
  modality: 'contradiction_pair';
  signalA: {
    statement: string;
    affirmIf: 'true' | 'false';
  };
  signalB: {
    statement: string;
    affirmIf: 'true' | 'false';
  };
  /** Pair id — referenced by contradictionDetectionEngine. */
  pairId: string;
  /** Severity assigned when both signals contradict their pairing expectation. */
  contradictionSeverity: 'low' | 'medium' | 'high' | 'critical';
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. evidence_strength — six-level evidence ladder
// ─────────────────────────────────────────────────────────────────────────────

export type EvidenceLevel =
  | 'NONE'
  | 'VERBAL'
  | 'DOCUMENTED'
  | 'OPERATIONAL'
  | 'VERIFIED'
  | 'CROSS_VALIDATED';

export interface EvidenceStrengthQuestion extends V2QuestionBase {
  modality: 'evidence_strength';
  subjectOfClaim: string;
  /** Branching rule — which next levels are gated on what answer. */
  branchOn: ReadonlyArray<{
    minLevel: EvidenceLevel;
    enables: ReadonlyArray<string>; // question ids in this same v2 registry
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. continuity_distribution — distribution-style probe over named
//    institutional functions (no individuals).
// ─────────────────────────────────────────────────────────────────────────────

export interface ContinuityDistributionQuestion extends V2QuestionBase {
  modality: 'continuity_distribution';
  /**
   * Bins are institutional FUNCTIONS or governance ROLES (not people).
   * Respondent allocates 100 points across bins to indicate continuity
   * concentration.
   */
  bins: ReadonlyArray<{
    id: string;
    label: string;
    rationale: string;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. dependency_mapping — declare which institutional functions depend on
//    which OTHER institutional functions. Drives topology graph extraction.
//    Strictly structural — never names individuals.
// ─────────────────────────────────────────────────────────────────────────────

export interface DependencyMappingQuestion extends V2QuestionBase {
  modality: 'dependency_mapping';
  fromNodes: ReadonlyArray<{ id: string; label: string }>;
  toNodes: ReadonlyArray<{ id: string; label: string }>;
  /** Maximum edges respondent may declare to avoid over-claim. */
  maxEdges: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. confidence_marker — interval-scale confidence statement with explicit
//    uncertainty-acknowledgement option.
// ─────────────────────────────────────────────────────────────────────────────

export interface ConfidenceMarkerQuestion extends V2QuestionBase {
  modality: 'confidence_marker';
  statement: string;
  /** 1..5 interval scale, with anchored labels. Mirrors LikertQuestion.scale. */
  scale: {
    min: 1;
    max: 5;
    minLabel: string;
    maxLabel: string;
  };
  /** When true, the question explicitly enables the "I don't know" path. */
  allowUncertaintyMarker: true;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. topology_mapping — places institutional functions on a structured grid
//    (e.g., centrality × distributedness). Strictly institutional.
// ─────────────────────────────────────────────────────────────────────────────

export interface TopologyMappingQuestion extends V2QuestionBase {
  modality: 'topology_mapping';
  axes: {
    x: { id: string; label: string; minLabel: string; maxLabel: string };
    y: { id: string; label: string; minLabel: string; maxLabel: string };
  };
  /** The functions/roles to be positioned — never individuals. */
  nodes: ReadonlyArray<{ id: string; label: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. stability_marker — declares whether a stated continuity property has
//    held across the most recent leadership transition(s) at any seniority.
// ─────────────────────────────────────────────────────────────────────────────

export interface StabilityMarkerQuestion extends V2QuestionBase {
  modality: 'stability_marker';
  statement: string;
  options: ReadonlyArray<{
    value: 'held' | 'partially_held' | 'broke' | 'no_recent_transition';
    label: string;
    score: number; // 0..1
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. transition_exposure — declares the institution's exposure to upcoming
//    or recent leadership / governance / role transitions, in structural
//    terms (count + scope), never naming individuals.
// ─────────────────────────────────────────────────────────────────────────────

export interface TransitionExposureQuestion extends V2QuestionBase {
  modality: 'transition_exposure';
  /** Time window the respondent should consider. Stable wording only. */
  window: 'past_12_months' | 'next_12_months' | 'past_and_next_12_months';
  /** Categories of transition under consideration. */
  categories: ReadonlyArray<{
    id: string;
    label: string; // e.g., "executive leadership", "board chair", "operations lead"
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Discriminated union
// ─────────────────────────────────────────────────────────────────────────────

export type V2Question =
  | ContradictionPairQuestion
  | EvidenceStrengthQuestion
  | ContinuityDistributionQuestion
  | DependencyMappingQuestion
  | ConfidenceMarkerQuestion
  | TopologyMappingQuestion
  | StabilityMarkerQuestion
  | TransitionExposureQuestion;
