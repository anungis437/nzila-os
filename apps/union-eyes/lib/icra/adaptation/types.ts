/**
 * ARTIFACT TYPE: Adaptive Assessment Types
 * MODULE: OCRA Dynamic Questionnaire Adaptation
 * DOCTRINE: docs/oci/assessment/OCI_ADAPTIVE_ASSESSMENT_DOCTRINE.md
 * DOCTRINE_VERSION: 1.0.0
 *
 * Type-only module. No I/O, no logic. Defines the deterministic shapes used
 * by every adaptation engine (classifier, routing, scoring, narrative).
 *
 * The version constant below MUST match the doctrine version. Drift is a
 * build break.
 */

export const ADAPTATION_DOCTRINE_VERSION = '1.0.0' as const;
export type AdaptationDoctrineVersion = typeof ADAPTATION_DOCTRINE_VERSION;

// ── Profile dimensions ─────────────────────────────────────────────────────

export type InstitutionalScale =
  | 'micro'
  | 'small'
  | 'mid_sized'
  | 'large'
  | 'enterprise'
  | 'federated_complex';

export type ContinuityComplexity =
  | 'low'
  | 'moderate'
  | 'elevated'
  | 'high'
  | 'organizational';

export type GovernanceComplexity =
  | 'simple'
  | 'structured'
  | 'multi_layer'
  | 'federated'
  | 'public_accountability';

export type ContinuityExposure =
  | 'localized'
  | 'cross_functional'
  | 'multi_site'
  | 'public_trust'
  | 'mission_critical';

export type RespondentLens =
  | 'inside_operator'
  | 'senior_decision_maker'
  | 'board_governance'
  | 'external_advisor'
  | 'legal_or_counsel'
  | 'unknown';

/** Reason any single profile field took the value it did. Audit-grade. */
export interface ProfileRationale {
  /** Which profile dimension this rationale explains. */
  readonly dimension:
    | 'institutionalScale'
    | 'continuityComplexity'
    | 'governanceComplexity'
    | 'continuityExposure'
    | 'respondentLens';
  /** Stable rule identifier (machine-readable, used in telemetry & tests). */
  readonly ruleId: string;
  /** One-sentence human-readable explanation. No free-text inputs allowed. */
  readonly statement: string;
  /** The form-declared inputs that drove this decision. Never includes PII. */
  readonly inputs: ReadonlyArray<{ key: string; value: string }>;
}

/**
 * Declared inputs preserved on the profile so adaptive rules can target the
 * original form selections (sector, size, governance model) without
 * recomputing. These are the SAME enum values the respondent selected on
 * the org-context form — no free text, no inferred data, no PII.
 */
export interface DeclaredProfileInputs {
  readonly sector?: string;
  readonly workforceBand?:
    | 'under_50'
    | '50_249'
    | '250_999'
    | '1000_4999'
    | '5000_plus';
  readonly governanceModel?:
    | 'elected_board'
    | 'appointed_board'
    | 'hybrid'
    | 'other';
  readonly hasFederationAffiliation: boolean;
}

/**
 * Deterministic organizational profile. Produced by `orgContextClassifier`
 * from form-declared inputs only. Never carries org name, free text, IP,
 * geolocation, device, or any inferred personal data.
 */
export interface InstitutionalAssessmentProfile {
  readonly doctrineVersion: AdaptationDoctrineVersion;
  readonly institutionalScale: InstitutionalScale;
  readonly continuityComplexity: ContinuityComplexity;
  readonly governanceComplexity: GovernanceComplexity;
  readonly continuityExposure: ContinuityExposure;
  readonly respondentLens: RespondentLens;
  /** Verbatim declared inputs the classifier consumed. Never PII. */
  readonly declaredInputs: DeclaredProfileInputs;
  readonly rationale: readonly ProfileRationale[];
  /** True iff every profile dimension was resolved from explicit inputs. */
  readonly isComplete: boolean;
  /**
   * Conservative-default flag. True when at least one dimension fell back to
   * its safe default because the required input was missing. Downstream
   * adapters MUST respect this flag and avoid speculative interpretation.
   */
  readonly usedConservativeDefault: boolean;
}

// ── Inputs to the classifier ───────────────────────────────────────────────

/**
 * Inputs the classifier accepts. Either:
 *  - the raw form record (`ctx_*` keyed), OR
 *  - a canonical `OrganizationContext` plus optional extras the canonical
 *    interface does not currently hold (`organizationType`, `organizationAge`).
 *
 * The classifier prefers the raw form record when present, since it carries
 * every declared field; the canonical context is a strict subset.
 */
export interface ClassifierInputs {
  /**
   * Raw form record, e.g. `{ ctx_org_type: 'national_union', ctx_sector: 'labour_union', ... }`.
   * Optional — when omitted, the classifier reads from `canonicalContext`
   * + `extras` only.
   */
  readonly rawForm?: Readonly<Record<string, string | undefined>>;
  /** Canonical OrganizationContext (sector, workforceBand, governanceModel, etc.). */
  readonly canonicalContext?: {
    readonly sector?: string;
    readonly workforceBand?:
      | 'under_50'
      | '50_249'
      | '250_999'
      | '1000_4999'
      | '5000_plus';
    readonly governanceModel?: 'elected_board' | 'appointed_board' | 'hybrid' | 'other';
    readonly federationAffiliation?: string;
    readonly respondentRole?:
      | 'self_senior_leader'
      | 'self_board_member'
      | 'self_staff'
      | 'on_behalf_consultant'
      | 'on_behalf_counsel'
      | 'on_behalf_other';
  };
  /**
   * Extras the canonical interface does not currently expose. The classifier
   * treats these as authoritative when supplied.
   */
  readonly extras?: {
    readonly organizationType?: string;
    readonly organizationAge?:
      | 'under_5_years'
      | '5_to_14_years'
      | '15_to_29_years'
      | '30_plus_years';
  };
}

// ── Eligibility / routing types used by Part 3 (forward-declared) ──────────

export interface InstitutionalProfileField {
  readonly field:
    | 'institutionalScale'
    | 'continuityComplexity'
    | 'governanceComplexity'
    | 'continuityExposure'
    | 'respondentLens';
  readonly value: string;
}

/**
 * Adaptive rules attached to a question. All rules are *additive*: a question
 * is included if it has no rules, or if its rules resolve to "include" for
 * the active profile. Suppressions take precedence over inclusions.
 */
export interface AdaptiveRules {
  readonly requiredFor?: readonly InstitutionalProfileField[];
  readonly recommendedFor?: readonly InstitutionalProfileField[];
  readonly suppressedFor?: readonly InstitutionalProfileField[];
  readonly minOrgComplexity?: ContinuityComplexity;
  readonly maxOrgComplexity?: ContinuityComplexity;
  readonly sectorRelevance?: readonly string[];
  readonly sizeRelevance?: ReadonlyArray<
    'under_50' | '50_249' | '250_999' | '1000_4999' | '5000_plus'
  >;
  readonly governanceRelevance?: ReadonlyArray<
    'elected_board' | 'appointed_board' | 'hybrid' | 'other'
  >;
  readonly respondentRelevance?: readonly RespondentLens[];
  /**
   * Routing-v2 (additive): list of routing-path ids that should DEEPEN
   * extraction on this question when activated. Strictly additive — the
   * routing-v2 evaluator may use this hint to escalate inclusion or
   * raise the confidence floor, but MUST NEVER suppress a question.
   * See `routing-v2/pathActivation.ts`.
   *
   * Typed as `readonly string[]` here to avoid a circular import on
   * `RoutingPathId`; the routing layer narrows it at consumption.
   */
  readonly pathDeepens?: ReadonlyArray<string>;
}

/**
 * Adaptive metadata attached to a question. Independent of `AdaptiveRules`:
 * `adaptiveWeight` describes the question's role across all profiles;
 * `adaptationPurpose` describes what kind of intelligence the question is
 * intended to contribute when included.
 */
export type AdaptiveWeight =
  | 'core'
  | 'contextual'
  | 'sector_specific'
  | 'scale_specific'
  | 'governance_specific'
  | 'respondent_specific';

export type AdaptationPurpose =
  | 'baseline_continuity'
  | 'complexity_detection'
  | 'sector_interpretation'
  | 'scale_interpretation'
  | 'governance_interpretation'
  | 'stabilization_relevance'
  | 'runtime_relevance'
  | 'intelligence_network_enrichment';
