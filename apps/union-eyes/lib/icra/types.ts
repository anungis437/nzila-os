/**
 * OCI Continuity Risk Assessment (ICRA) — Types
 *
 * Doctrine-aligned. Continuity intelligence infrastructure, not a quiz.
 * Every type is shaped for: explainability, replayability, auditability,
 * and future longitudinal benchmarking.
 *
 * NO opaque AI scoring. NO surveillance vocabulary.
 * Continuity over heroics. Governance before scale.
 */

export type SectionId =
  | 'organizational_context'
  | 'operational_dependency'
  | 'governance_visibility'
  | 'institutional_memory'
  | 'transition_readiness'
  | 'operational_coordination'
  | 'explainability_trust'
  | 'sovereignty_governance';

export type DimensionId =
  | 'institutional_continuity'
  | 'governance_fragility'
  | 'trust_debt'
  | 'operational_memory'
  | 'transition_readiness';

export type QuestionType = 'likert_5' | 'multiple_choice' | 'maturity_select';

export type MaturityBandId =
  | 'personality_dependent'
  | 'fragmented_coordination'
  | 'structured_governance'
  | 'continuity_aware'
  | 'continuity_intelligence';

/**
 * Per-dimension weight contribution. A question can contribute to multiple
 * dimensions — continuity is multi-faceted doctrine.
 *
 * governance_fragility and trust_debt are RISK dimensions; high raw score
 * means MORE fragility. They are inverted before composition.
 */
export type DimensionWeights = Partial<Record<DimensionId, number>>;

export interface QuestionOption {
  value: string;
  label: string;
  /** 0..1 normalized maturity contribution (higher = more continuity-mature) */
  score: number;
  /** Optional narrative shown in results if this option is selected. */
  observation?: string;
}

export interface BaseQuestion {
  id: string;
  section: SectionId;
  order: number;
  prompt: string;
  helpText?: string;
  weights: DimensionWeights;
  /** If true, weighted dimensions are RISK dimensions (high score = more fragility). */
  riskInverted?: boolean;
  allowNote?: boolean;
  rationale?: string;
}

export interface LikertQuestion extends BaseQuestion {
  type: 'likert_5';
  scale: {
    min: 1;
    max: 5;
    minLabel: string;
    maxLabel: string;
  };
}

export interface MultipleChoiceQuestion extends BaseQuestion {
  type: 'multiple_choice';
  options: QuestionOption[];
}

export interface MaturitySelectQuestion extends BaseQuestion {
  type: 'maturity_select';
  options: QuestionOption[]; // ordered, aligning to maturity bands
}

export type Question = LikertQuestion | MultipleChoiceQuestion | MaturitySelectQuestion;

/**
 * Persisted answer — captures everything needed to replay scoring even if
 * the question bank evolves.
 */
export interface Answer {
  questionId: string;
  questionVersion: number;
  rawValue: string | number;
  normalizedScore: number; // 0..1
  weightsSnapshot: DimensionWeights;
  riskInverted: boolean;
  note?: string;
  answeredAt: string;
}

export interface DimensionScore {
  dimension: DimensionId;
  score: number; // 0..100, continuity-positive
  contributingQuestions: number;
  weightTotal: number;
}

export interface SectionScore {
  section: SectionId;
  score: number; // 0..100
  questionsAnswered: number;
}

/**
 * Canonical OCI band names — the public-facing, institution-grade vocabulary.
 * operationalPattern is the internal/sublabel description.
 */
export type OciBandId =
  | 'tribal_continuity'
  | 'documented_continuity'
  | 'structured_continuity'
  | 'evidence_backed_continuity'
  | 'continuity_native';

export interface MaturityBand {
  id: MaturityBandId;
  ordinal: 1 | 2 | 3 | 4 | 5;
  /** @deprecated Use ociBandName for display. Kept for serialization compat. */
  name: string;
  /** Canonical OCI category name — the primary display label. e.g. "Tribal Continuity" */
  ociBandName: string;
  /** Operational pattern sublabel — describes the structural reality. e.g. "Personality Dependent" */
  operationalPattern: string;
  summary: string;
  operationalCharacteristics: string[];
  governanceImplications: string[];
  continuityImplications: string[];
  minComposite: number;
}

export interface ContinuityObservation {
  id: string;
  severity: 'informational' | 'attention' | 'material';
  category: 'governance' | 'operational' | 'memory' | 'transition' | 'trust' | 'sovereignty';
  statement: string;
  evidence?: string[];
}

export interface FollowupRecommendation {
  id: string;
  kind:
    | 'starter_kit'
    | 'continuity_review'
    | 'governance_workshop'
    | 'pilot_conversation'
    | 'assessment_walkthrough';
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
}

export interface InstitutionalContinuityProfile {
  assessmentId: string;
  generatedAt: string;
  maturityBand: MaturityBand;
  composite: number; // 0..100
  dimensions: DimensionScore[];
  sections: SectionScore[];
  observations: ContinuityObservation[];
  recommendations: FollowupRecommendation[];
  answeredQuestionCount: number;
  questionBankVersion: number;
  /** Cross-dimensional emotional insights from the insight engine. */
  insights?: ContinuityInsight[];
  /** Recognizable institutional pattern signals. */
  continuitySignals?: ContinuitySignal[];
  /** Stewardship-layer signals with severity. */
  stewardshipSignals?: StewardshipSignal[];
  /** Continuity Burden Index — how much continuity depends on human compensation. */
  burdenIndex?: ContinuityBurdenIndex;
  /** Revenue tier for this profile's output display. Defaults to free tier. */
  reportTierId?: ReportTierId;
}

export interface OrganizationContext {
  name?: string;
  sector?: string;
  jurisdiction?: string;
  workforceBand?:
    | 'under_50'
    | '50_249'
    | '250_999'
    | '1000_4999'
    | '5000_plus';
  governanceModel?: 'elected_board' | 'appointed_board' | 'hybrid' | 'other';
  federationAffiliation?: string;
}

export interface ConsentRecord {
  acceptedAt: string;
  doctrineVersion: string;
  acknowledgedAntiSurveillance: boolean;
  acknowledgedDataHandling: boolean;
  acknowledgedExplainability: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// OCI Commercialization Layer — Insight Engine, Tiers, Personas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Category of cross-dimensional insight detected by the insight engine.
 * Each represents a recognizable institutional tension or continuity contradiction.
 */
export type InsightCategory =
  | 'modernization_continuity_gap'
  | 'invisible_labour'
  | 'governance_drift'
  | 'reconstruction_burden'
  | 'institutional_forgetting'
  | 'evidence_governance_gap'
  | 'stewardship_concentration';

/**
 * A cross-dimensional emotional observation generated by the insight engine.
 * These are what people remember. Written in a calm, "quietly devastating" register.
 *
 * `evidenceBasis` carries auditability: the dimensions and signals that triggered
 * the insight, plus the report sections it most directly informs. Optional for
 * back-compat; populated by the insight engine for v2+ insights.
 */
export interface ContinuityInsight {
  id: string;
  category: InsightCategory;
  headline: string;
  body: string;
  dimensionsInvolved: DimensionId[];
  severity: 'observed' | 'notable' | 'material';
  /** Auditability hint — sections of the report this insight most directly informs. */
  affectedSections?: SectionId[];
  /** Auditability hint — short evidence phrase (e.g. "institutional_continuity 28; operational_memory 31"). */
  evidenceBasis?: string;
}

/**
 * A recognizable institutional pattern derived from dimension scores.
 * Rendered as a forensic signal list — not alarming, factual and institutional.
 */
export interface ContinuitySignal {
  id: string;
  label: string;
  observed: boolean;
}

/**
 * A stewardship-layer signal — elevates the category beyond software
 * into institutional care and obligation.
 */
export interface StewardshipSignal {
  id: string;
  label: string;
  severity: 'low' | 'moderate' | 'elevated';
}

/**
 * Continuity Burden Index™ — measures how much continuity depends on
 * humans compensating manually. Higher score = more human-compensated continuity.
 * Score (0–100) and interpretation are free; full humanCompensationIndicators
 * are gated behind the Executive Continuity Brief.
 */
export interface ContinuityBurdenIndex {
  score: number; // 0–100, higher = more burden concentrated in people
  interpretation: string; // single-line calm observation
  humanCompensationIndicators: string[]; // gated in Executive Continuity Brief
}

/**
 * Revenue tier identifiers — institutional naming, not SaaS vocabulary.
 */
export type ReportTierId =
  | 'continuity_reflection'
  | 'executive_continuity_brief'
  | 'institutional_continuity_diagnostic';

/**
 * Executive persona — used by insight engine for copy variant selection.
 */
export type ExecutivePersonaId =
  | 'executive_director'
  | 'union_leadership'
  | 'healthcare_ops'
  | 'cio_coo'
  | 'governance_board'
  | 'federated_org';

/**
 * UTM attribution parameters — captured consent-aware, no PII.
 */
export interface UtmParams {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
}
