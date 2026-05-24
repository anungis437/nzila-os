/**
 * ARTIFACT TYPE: IP / Contracts
 * PACKAGE: @nzila/oci-confidence
 * DOCTRINE_VERSION: 1.0.0
 *
 * Authoritative contract types for the OCI Confidence Infrastructure™.
 * These types are surfaced to all OCI framework consumers.
 *
 * Anti-surveillance: confidence values are about the methodology's
 * own epistemic standing, never about individuals.
 *
 * Honest posture: confidence is a categorical state, not a probability.
 */

export const CONFIDENCE_STATES = ['HIGH', 'MODERATE', 'LOW', 'INSUFFICIENT'] as const;
export type ConfidenceState = (typeof CONFIDENCE_STATES)[number];

export const CAUTION_STATES = [
  'SMALL_SAMPLE',
  'INCOMPLETE_VISIBILITY',
  'HIGH_VARIANCE',
  'TRANSITIONAL_INSTABILITY',
  'OUTDATED_ASSESSMENT',
  'LIMITED_GOVERNANCE_EVIDENCE',
] as const;
export type CautionState = (typeof CAUTION_STATES)[number];

export const STABILITY_STATES = ['STABLE', 'TRANSITIONAL', 'VOLATILE', 'UNKNOWN'] as const;
export type StabilityState = (typeof STABILITY_STATES)[number];

export const DECAY_BANDS = ['NONE', 'MILD', 'MODERATE', 'SEVERE'] as const;
export type DecayBand = (typeof DECAY_BANDS)[number];

/** Inputs the universal confidence model consumes. All fields optional. */
export interface ConfidenceInputs {
  /** Number of observations or carriers used to compute the value. */
  readonly sampleSize?: number;
  /** Completeness in [0,1]; share of expected inputs present. */
  readonly dataCompleteness?: number;
  /** Stability classification from the stability engine. */
  readonly stability?: StabilityState;
  /** Age of the assessment in days, used by the decay model. */
  readonly assessmentAgeDays?: number;
  /** Whether reviewer-led governance evidence is present. */
  readonly governanceEvidencePresent?: boolean;
  /** Inter-reviewer variance signal in [0,1]; higher means more disagreement. */
  readonly reviewerVariance?: number;
}

/**
 * Universal OCI confidence envelope. Every framework output should
 * eventually wrap its primary value in this envelope.
 */
export interface ConfidenceEnvelope<TScore> {
  readonly score: TScore;
  readonly confidence: ConfidenceState;
  readonly sampleSize: number;
  readonly dataCompleteness: number;
  readonly stability: StabilityState;
  readonly cautionStates: ReadonlyArray<CautionState>;
  readonly confidenceRationale: ReadonlyArray<string>;
  readonly decay: DecayBand;
  readonly assessmentAgeDays: number | null;
}

/** Stability engine inputs. */
export interface StabilityInputs {
  readonly modernizationVolatility?: number;
  readonly governanceVolatility?: number;
  readonly onboardingInstability?: number;
  readonly stewardshipTurnover?: number;
  readonly continuityVariance?: number;
  readonly transitionTurbulence?: number;
}

export interface StabilityResult {
  readonly stabilityScore: number;
  readonly state: StabilityState;
  readonly varianceIndicators: ReadonlyArray<string>;
  readonly volatilitySignals: ReadonlyArray<string>;
  readonly temporalConfidence: ConfidenceState;
}

/** Visualisation surface. Calm and non-alarmist. */
export interface ConfidenceVisualModel {
  readonly ribbon: 'green' | 'amber' | 'grey' | 'slate';
  readonly badges: ReadonlyArray<{ readonly label: string; readonly tone: 'neutral' | 'caution' | 'reassuring' }>;
  readonly completenessLabel: string;
  readonly interpretiveSummary: string;
}
