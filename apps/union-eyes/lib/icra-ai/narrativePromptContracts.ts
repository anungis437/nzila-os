/**
 * narrativePromptContracts
 * ────────────────────────
 * Typed wall between the deterministic continuity core and the AI synthesis
 * layer. Any caller that attempts to pass a forbidden field through this
 * boundary fails TypeScript compilation; the runtime builder in
 * `buildNarrativeContext.ts` additionally strips unexpected keys defensively.
 *
 * Boundary doctrine: docs/oci/ai/AI_DATA_BOUNDARY_MODEL.md
 */

export const SYNTHESIS_ENGINE_VERSION = '1.0.0' as const;
export const PROMPT_REGISTRY_VERSION = '1.0.0' as const;

export type SupportedNarrativeLocale = 'en-CA' | 'fr-CA';

export type NarrativeArtifactKind =
  | 'ExecutiveSummary'
  | 'ContinuityNarrative'
  | 'OperationalObservation'
  | 'GovernanceReflection'
  | 'StewardshipObservation'
  | 'ContinuityTransitionNarrative'
  | 'ModernizationAlignmentNarrative'
  | 'BoardBriefNarrative'
  | 'FacilitatorSummary';

/**
 * Forbidden artefact kinds. Listed for documentation purposes; the type
 * system prevents accidental use because they are never part of the union.
 */
export type ForbiddenNarrativeArtifactKind =
  | 'RiskScore'
  | 'InstitutionRank'
  | 'GovernanceGrade'
  | 'InstitutionalTrustScore'
  | 'PsychologicalProfile'
  | 'LeadershipRating';

export interface MaturityBandSignal {
  readonly pillarId: string;
  readonly band:
    | 'foundational'
    | 'developing'
    | 'established'
    | 'mature'
    | 'leading';
}

export interface AdaptiveContextBands {
  readonly institutionalScale: string;
  readonly continuityComplexity: string;
  readonly governanceComplexity: string;
  readonly continuityExposure: string;
  readonly respondentLens: string;
}

export interface ArchetypeSignal {
  readonly archetypeId: string;
  readonly canonicalSummary: string;
}

export interface ContinuityBreakpointSignal {
  readonly breakpointId: string;
  readonly canonicalDescription: string;
}

export interface ContinuityConfidenceSignal {
  readonly confidenceBand: 'low' | 'moderate' | 'high';
  readonly stabilityBand: 'volatile' | 'stable' | 'reinforcing';
}

export interface StructuralContinuitySignal {
  readonly signalId: string;
  readonly band: string;
}

export interface OnboardingSurvivabilityFinding {
  readonly findingId: string;
  readonly canonicalSummary: string;
}

export interface GovernanceContinuityObservation {
  readonly observationId: string;
  readonly canonicalSummary: string;
}

/**
 * NarrativeContext — the ONLY payload the AI synthesis layer ever receives.
 *
 * Forbidden by construction:
 *   - raw answers, raw free text, raw transcripts
 *   - telemetry, typing cadence, session timing
 *   - behavioural metadata, emotional inference
 *   - organization name (except in BoardBriefNarrative artefacts with explicit consent)
 *   - email, persona, attribution, contact info
 */
export interface NarrativeContext {
  readonly artifactKind: NarrativeArtifactKind;
  readonly locale: SupportedNarrativeLocale;
  readonly synthesisEngineVersion: typeof SYNTHESIS_ENGINE_VERSION;
  readonly promptRegistryVersion: typeof PROMPT_REGISTRY_VERSION;
  readonly maturityBands: ReadonlyArray<MaturityBandSignal>;
  readonly adaptiveContext: AdaptiveContextBands;
  readonly archetypes: ReadonlyArray<ArchetypeSignal>;
  readonly breakpoints: ReadonlyArray<ContinuityBreakpointSignal>;
  readonly confidence: ContinuityConfidenceSignal;
  readonly structuralSignals: ReadonlyArray<StructuralContinuitySignal>;
  readonly onboardingFindings: ReadonlyArray<OnboardingSurvivabilityFinding>;
  readonly governanceObservations: ReadonlyArray<GovernanceContinuityObservation>;
  /**
   * Reviewer-authored notes intended to steer narrative emphasis. NEVER raw
   * respondent free text — this is reviewer-supplied guidance only.
   */
  readonly reviewerSteer?: string;
}

/**
 * Fields that must NEVER appear on a NarrativeContext, listed here so the
 * privacy regression test can scan prompt payloads for accidental presence.
 */
export const FORBIDDEN_CONTEXT_KEYS = Object.freeze([
  'rawAnswers',
  'answers',
  'freeText',
  'transcript',
  'telemetry',
  'typingCadence',
  'sessionTiming',
  'behaviouralMetadata',
  'emotionalInference',
  'email',
  'persona',
  'attribution',
  'organizationName',
  'orgName',
  'memberNames',
  'employeeNames',
  'ipAddress',
] as const);

export type ForbiddenContextKey = (typeof FORBIDDEN_CONTEXT_KEYS)[number];
