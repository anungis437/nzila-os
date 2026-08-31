/**
 * OCI Benchmark Intelligence — types.
 *
 * Schemas for the benchmark layer of the OCI Method.
 *
 * The benchmark layer captures three things:
 *  1. Sector baselines  — characteristic profiles of institutional
 *     sectors that ground a pilot in sector-appropriate expectations
 *     without ranking institutions against each other.
 *  2. Stewardship-burden pattern typology — recognised institutional
 *     patterns of stewardship density and burden, named at the
 *     institutional (not personal) level.
 *  3. Aggregate intelligence — opt-in, k-anonymous aggregation across
 *     institutions that have explicitly consented in writing.
 *
 * Doctrine constraints (binding on every consumer of these types):
 *  - No individual-level signals are permitted at any layer.
 *  - No ranked comparison of institutions is produced.
 *  - No behavioural inference is produced about stewards or members.
 *  - Aggregation requires explicit, recorded opt-in per institution.
 *  - Aggregation requires a minimum k-anonymity threshold before any
 *    cell may be returned.
 *
 * See:
 *  - docs/oci/OCI_METHOD.md (Sections 3.6, 3.7, 6.5)
 *  - docs/oci/OCI_AI_BOUNDARY.md
 *  - docs/oci/OCI_ANTI_SURVEILLANCE_POSITION.md
 *  - docs/oci/OCI_DATA_HANDLING.md
 */

import type { LocalizedString } from '../facilitation/types';

// ─────────────────────────────────────────────────────────────────────────────
// Sector typology
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical institutional sectors the benchmark layer recognises.
 * Sectors are intentionally narrow and named in institutional terms.
 */
export type InstitutionalSectorId =
  | 'union-cba-administration'
  | 'union-pension-administration'
  | 'healthcare-clinical-governance'
  | 'healthcare-administrative-governance'
  | 'municipal-government'
  | 'regional-government'
  | 'federal-program-administration'
  | 'post-secondary-academic-governance'
  | 'post-secondary-administrative-governance'
  | 'non-profit-federation'
  | 'cooperative-governance'
  | 'regulated-professional-college';

/**
 * Coarse classification of how institutional authority is held in a sector.
 * Used to ground facilitation posture, not to rank institutions.
 */
export type GovernanceShape =
  | 'representative-elected'
  | 'representative-delegated'
  | 'professional-self-governing'
  | 'hybrid-public-mandate';

export type PressureProfile = 'low' | 'moderate' | 'high' | 'acute';

export type RegulatoryProfile =
  | 'light'
  | 'moderate'
  | 'high'
  | 'multi-jurisdictional';

/**
 * Typical observed range for a continuous institutional measure within
 * a sector. The values are characteristic, not normative; an institution
 * outside the range is not "below baseline" — it is differently shaped.
 */
export interface SectorRange {
  readonly low: number;
  readonly median: number;
  readonly high: number;
}

export interface SectorBaseline {
  readonly sectorId: InstitutionalSectorId;
  readonly displayName: LocalizedString;
  readonly description: LocalizedString;
  readonly governanceShape: GovernanceShape;
  /** Number of stewards per 100 members typically carrying continuity load. */
  readonly typicalStewardshipDensityRange: SectorRange;
  /** Years of accumulated institutional memory typically concentrated in <=2 stewards. */
  readonly typicalContinuityFragilityRange: SectorRange;
  /** Burden pattern ids most commonly observed in this sector. */
  readonly commonBurdenPatternIds: readonly StewardshipBurdenPatternId[];
  readonly modernizationPressureProfile: PressureProfile;
  readonly regulatoryEnvironmentProfile: RegulatoryProfile;
  /** Notes the method holds about delivering inside this sector. */
  readonly facilitationPostureNotes: LocalizedString;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stewardship-burden pattern typology
// ─────────────────────────────────────────────────────────────────────────────

export type StewardshipBurdenCategory =
  | 'governance-density'
  | 'interpretive-density'
  | 'operational-process-density'
  | 'onboarding-mentorship-density'
  | 'external-counterpart-memory-density'
  | 'modernization-stewardship-overload'
  | 'continuity-fairness-imbalance'
  | 'silent-stewardship';

export type StewardshipBurdenPatternId =
  // governance-density
  | 'gd-chair-concentration'
  | 'gd-committee-quorum-fragility'
  | 'gd-officer-overlap'
  // interpretive-density
  | 'id-single-interpreter'
  | 'id-oral-interpretation-record'
  | 'id-drift-without-witness'
  // operational-process-density
  | 'op-process-by-one-steward'
  | 'op-undocumented-decision-points'
  | 'op-process-rationale-loss'
  // onboarding-mentorship-density
  | 'om-mentor-dependency'
  | 'om-orientation-by-presence'
  | 'om-cohort-gap'
  // external-counterpart-memory-density
  | 'em-external-memory-holder'
  | 'em-vendor-rationale-keeper'
  | 'em-regulator-context-holder'
  // modernization-stewardship-overload
  | 'mo-modernization-by-one-steward'
  | 'mo-modernization-with-day-job'
  | 'mo-modernization-rationale-loss'
  // continuity-fairness-imbalance
  | 'cf-unrecognised-load'
  | 'cf-load-on-quieter-voice'
  | 'cf-reciprocity-gap'
  // silent-stewardship
  | 'ss-invisible-role'
  | 'ss-load-not-in-job-description'
  | 'ss-cohort-load-on-one-person';

export interface StewardshipBurdenPattern {
  readonly id: StewardshipBurdenPatternId;
  readonly category: StewardshipBurdenCategory;
  readonly name: LocalizedString;
  readonly description: LocalizedString;
  readonly institutionalIndicators: { readonly 'en-CA': readonly string[] };
  readonly mappingPrompts: { readonly 'en-CA': readonly string[] };
  readonly stabilizationOptions: { readonly 'en-CA': readonly string[] };
  readonly redLines: { readonly 'en-CA': readonly string[] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregate intelligence — intake and result types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * An institutional submission considered for inclusion in the
 * aggregate intelligence layer.
 *
 * Every field below is recorded at the institutional level. The intake
 * MUST NOT carry person-level identifiers, role-level identifiers tied
 * to a specific person, or any field that could be used to re-identify
 * an individual steward.
 */
export interface AggregateIntake {
  /** Opaque, rotating institution id. Not a name. Not a domain. */
  readonly institutionId: string;
  /** Sector classification chosen by the institution. */
  readonly sectorId: InstitutionalSectorId;
  /**
   * Explicit, recorded opt-in for aggregate inclusion.
   * `false` means the intake is for the institution's own use only
   * and must never enter aggregation.
   */
  readonly aggregateOptIn: boolean;
  /** ISO 8601 date the opt-in record was captured. */
  readonly optInRecordedAt: string;
  /** Stewards per 100 members carrying continuity load. */
  readonly stewardshipDensity: number;
  /** Years of accumulated memory typically concentrated in <=2 stewards. */
  readonly continuityFragility: number;
  /** Count of burden patterns the institution has named in its own mapping. */
  readonly burdenPatternCount: number;
  /** Pattern ids the institution has flagged as present. */
  readonly presentBurdenPatternIds: readonly StewardshipBurdenPatternId[];
}

/**
 * Aggregate sector statistic returned to opted-in institutions
 * after a successful k-anonymity check.
 */
export interface SectorAggregate {
  readonly sectorId: InstitutionalSectorId;
  /** Number of institutions contributing to this cell. Always >= K. */
  readonly contributingInstitutionCount: number;
  readonly stewardshipDensity: SectorRange;
  readonly continuityFragility: SectorRange;
  readonly burdenPatternCount: SectorRange;
  /**
   * Pattern frequencies — fraction of contributing institutions in
   * which the pattern was flagged present. Suppressed below K.
   */
  readonly burdenPatternFrequencies: Readonly<
    Partial<Record<StewardshipBurdenPatternId, number>>
  >;
}

/**
 * The result of an aggregation request. Cells that fail the k-anonymity
 * check are reported as suppressed rather than silently omitted.
 */
export interface AggregateResult {
  readonly minimumKApplied: number;
  readonly returnedAt: string;
  readonly aggregates: readonly SectorAggregate[];
  readonly suppressedSectors: readonly {
    readonly sectorId: InstitutionalSectorId;
    readonly contributingInstitutionCount: number;
    readonly reason: 'below-k-anonymity-threshold';
  }[];
}
