/**
 * Institutional Continuity Risk Assessment (ICRA) — Types
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

export interface MaturityBand {
  id: MaturityBandId;
  ordinal: 1 | 2 | 3 | 4 | 5;
  name: string;
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
