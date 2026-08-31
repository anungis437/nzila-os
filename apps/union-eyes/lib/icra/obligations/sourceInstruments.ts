/**
 * ARTIFACT TYPE: Government-Readiness Additive Layer — Source Instrument Taxonomy
 * MODULE: OCI/OCRA Source Instrument + Citation reference data (Phase G)
 * DOCTRINE: docs/oci/superseded/government-readiness/OCI_OCRA_SOURCE_INSTRUMENT_TRACEABILITY.md
 * DOCTRINE_VERSION: 1.0.0
 *
 * Phase G extends the traceability chain from an abstract obligation CLASS
 * (governance, fiduciary, …) to the SPECIFIC instrument that creates the duty:
 *
 *   Finding → Obligation class → Source Instrument → Citation → Consequence
 *
 * SAFETY CONSTITUTION (non-negotiable):
 *   1. This module is reference data only. It NEVER imports the scoring engine
 *      and can never influence a dimension, composite, or maturity band.
 *   2. Every seeded instrument is `UNVERIFIED`. Clause references are intentionally
 *      empty (`null`). NOTHING here asserts an authoritative legal citation.
 *      The catalogue is a validator-reviewable scaffold, not a legal opinion.
 *   3. A citation can only become `defensible` when BOTH (a) the finding's
 *      evidence meets the instrument's assertion floor AND (b) the instrument has
 *      been independently confirmed (verificationStatus ≥ VALIDATOR_CONFIRMED).
 *      Because the seed is entirely UNVERIFIED, no citation is currently
 *      defensible — by design, and honestly so for the validation session.
 */

import { isAtLeast, type EvidenceLevel } from '../evidence-strength/evidenceTaxonomy';
import type { ObligationClassId } from './obligationTaxonomy';

export const SOURCE_INSTRUMENT_CATALOGUE_VERSION = '0.2.0-unverified';

/** The kind of instrument that creates a duty. Low-cardinality, enumerated. */
export type InstrumentKind =
  | 'statute'
  | 'regulation'
  | 'treasury_board_instrument'
  | 'directive'
  | 'policy'
  | 'standard'
  | 'mandate'
  | 'bylaw';

/** Jurisdiction band. Low-cardinality; never a person or place identifier. */
export type Jurisdiction =
  | 'federal'
  | 'provincial'
  | 'municipal'
  | 'sector_standard'
  | 'institutional'
  | 'unspecified';

/**
 * Legal force an instrument can carry, independent of who issued it. This is the
 * "how binding" axis — distinct from `kind` (what the instrument is) and
 * `jurisdiction` (whose it is). It lets a reviewer weigh a citation's gravity
 * without re-deriving it from the instrument kind. Reference data only; it never
 * touches a score.
 */
export type AuthorityLevel =
  | 'primary_legislation' // Acts of a legislature — the strongest duty source
  | 'subordinate_legislation' // regulations made under an enabling Act
  | 'binding_executive_policy' // TB instruments, directives, mandates: binding by executive authority
  | 'binding_institutional' // bylaws, internal policy/delegation: binding within the institution
  | 'advisory_standard'; // standards/guidance: referenceable, binding only once adopted

const AUTHORITY_LEVEL_BY_KIND: Record<InstrumentKind, AuthorityLevel> = Object.freeze({
  statute: 'primary_legislation',
  regulation: 'subordinate_legislation',
  treasury_board_instrument: 'binding_executive_policy',
  directive: 'binding_executive_policy',
  mandate: 'binding_executive_policy',
  policy: 'binding_institutional',
  bylaw: 'binding_institutional',
  standard: 'advisory_standard',
});

/** Default authority level for an instrument kind (used when adding entries). */
export function authorityLevelForKind(kind: InstrumentKind): AuthorityLevel {
  return AUTHORITY_LEVEL_BY_KIND[kind];
}

/**
 * Verification status of an instrument reference. The seed catalogue is wholly
 * `UNVERIFIED`. A validator (e.g. Richard Sharpe) may promote entries to
 * `VALIDATOR_CONFIRMED`; only an authoritative legal source promotes to
 * `AUTHORITATIVE`. This axis is what keeps OCI/OCRA from asserting law it has
 * not earned the right to assert.
 */
export type VerificationStatus = 'UNVERIFIED' | 'VALIDATOR_CONFIRMED' | 'AUTHORITATIVE';

const VERIFICATION_ORDER: readonly VerificationStatus[] = [
  'UNVERIFIED',
  'VALIDATOR_CONFIRMED',
  'AUTHORITATIVE',
];

export function isVerifiedAtLeast(
  actual: VerificationStatus,
  required: VerificationStatus,
): boolean {
  return VERIFICATION_ORDER.indexOf(actual) >= VERIFICATION_ORDER.indexOf(required);
}

/**
 * Per-kind evidence floor at which a citation may move from `referenced`
 * (named, flagged) to `asserted` (presented as applicable). This is the
 * structural answer to "at what evidence threshold may OCI/OCRA reference a
 * statute, policy, or directive?" — statutes/regulations demand the highest bar.
 */
export const ASSERTION_FLOOR_BY_KIND: Record<InstrumentKind, EvidenceLevel> = Object.freeze({
  statute: 'VERIFIED',
  regulation: 'VERIFIED',
  treasury_board_instrument: 'DOCUMENTED',
  directive: 'DOCUMENTED',
  policy: 'DOCUMENTED',
  standard: 'DOCUMENTED',
  mandate: 'DOCUMENTED',
  bylaw: 'DOCUMENTED',
});

export interface SourceInstrument {
  readonly id: string;
  readonly kind: InstrumentKind;
  readonly jurisdiction: Jurisdiction;
  /** Legal force the instrument carries (how binding), independent of kind. */
  readonly authorityLevel: AuthorityLevel;
  /** Publicly-known instrument name OR a generic placeholder. Never invented law. */
  readonly title: string;
  readonly issuingAuthority: string;
  /** Obligation class this instrument is a candidate source for. */
  readonly obligationClass: ObligationClassId;
  /**
   * Specific clause/section reference. INTENTIONALLY `null` in the seed — a
   * clause is only populated once a validator confirms it. We never fabricate
   * section numbers.
   */
  readonly clauseRef: string | null;
  /**
   * In-force date of the instrument, ISO-8601 (YYYY-MM-DD). INTENTIONALLY `null`
   * in the seed — we never fabricate an effective date. A validator supplies it.
   */
  readonly effectiveDate: string | null;
  readonly verificationStatus: VerificationStatus;
  /** Reviewer-facing note explaining why this is a candidate and what to verify. */
  readonly note: string;
}

/**
 * UNVERIFIED starter catalogue. These are *candidate* instruments to anchor the
 * obligation-class → source-instrument step. Names that are publicly known are
 * used as labels only; clause references are empty; the whole set is UNVERIFIED.
 * Richard (or counsel) confirms, corrects, or replaces each entry.
 */
export const SOURCE_INSTRUMENTS: Record<string, SourceInstrument> = Object.freeze({
  'si.enabling_statute': {
    id: 'si.enabling_statute',
    kind: 'statute',
    jurisdiction: 'unspecified',
    title: 'Institution-specific enabling statute',
    authorityLevel: 'primary_legislation',
    effectiveDate: null,
    issuingAuthority: 'Legislature (institution-dependent)',
    obligationClass: 'statutory',
    clauseRef: null,
    verificationStatus: 'UNVERIFIED',
    note: 'Placeholder for the primary act constituting the institution. Confirm the exact act and section.',
  },
  'si.delegated_regulation': {
    id: 'si.delegated_regulation',
    kind: 'regulation',
    jurisdiction: 'unspecified',
    title: 'Applicable delegated regulation',
    authorityLevel: 'subordinate_legislation',
    effectiveDate: null,
    issuingAuthority: 'Regulator (sector-dependent)',
    obligationClass: 'regulatory',
    clauseRef: null,
    verificationStatus: 'UNVERIFIED',
    note: 'Placeholder for the regulation imposing the relevant duty. Confirm regulator and provision.',
  },
  'si.tb_policy_service_digital': {
    id: 'si.tb_policy_service_digital',
    kind: 'treasury_board_instrument',
    jurisdiction: 'federal',
    title: 'Treasury Board Policy on Service and Digital',
    authorityLevel: 'binding_executive_policy',
    effectiveDate: null,
    issuingAuthority: 'Treasury Board of Canada Secretariat',
    obligationClass: 'policy',
    clauseRef: null,
    verificationStatus: 'UNVERIFIED',
    note: 'Candidate federal policy instrument for records, service continuity, and accountability. Confirm applicability and the specific section before assertion.',
  },
  'si.records_retention_schedule': {
    id: 'si.records_retention_schedule',
    kind: 'directive',
    jurisdiction: 'institutional',
    title: 'Records management / retention directive',
    authorityLevel: 'binding_executive_policy',
    effectiveDate: null,
    issuingAuthority: 'Institution (records authority)',
    obligationClass: 'operational',
    clauseRef: null,
    verificationStatus: 'UNVERIFIED',
    note: 'Placeholder for the retention schedule governing decision records. Confirm the directive and clause.',
  },
  'si.governance_bylaws': {
    id: 'si.governance_bylaws',
    kind: 'bylaw',
    jurisdiction: 'institutional',
    title: 'Institutional governance bylaws / delegation instrument',
    authorityLevel: 'binding_institutional',
    effectiveDate: null,
    issuingAuthority: 'Institution (board/governing body)',
    obligationClass: 'governance',
    clauseRef: null,
    verificationStatus: 'UNVERIFIED',
    note: 'Placeholder for the bylaw or delegation instrument defining authority. Confirm the instrument and article.',
  },
  'si.fiduciary_duty_framework': {
    id: 'si.fiduciary_duty_framework',
    kind: 'policy',
    jurisdiction: 'institutional',
    title: 'Fiduciary duty / prudent administration framework',
    authorityLevel: 'binding_institutional',
    effectiveDate: null,
    issuingAuthority: 'Institution (governing body)',
    obligationClass: 'fiduciary',
    clauseRef: null,
    verificationStatus: 'UNVERIFIED',
    note: 'Placeholder for the instrument articulating duties of care, loyalty, and prudence. Confirm source.',
  },
  'si.iso_22301_continuity': {
    id: 'si.iso_22301_continuity',
    kind: 'standard',
    jurisdiction: 'sector_standard',
    title: 'ISO 22301 — Business Continuity Management Systems',
    authorityLevel: 'advisory_standard',
    effectiveDate: null,
    issuingAuthority: 'International Organization for Standardization',
    obligationClass: 'continuity',
    clauseRef: null,
    verificationStatus: 'UNVERIFIED',
    note: 'Candidate continuity standard. Standards are referenceable but adoption/applicability must be confirmed before assertion.',
  },
});

export const SOURCE_INSTRUMENT_IDS: readonly string[] = Object.freeze(
  Object.keys(SOURCE_INSTRUMENTS),
);

/** How strongly a citation is being put forward. */
export type CitationAssertion = 'asserted' | 'referenced' | 'withheld';

export interface Citation {
  readonly instrumentId: string;
  readonly obligationClass: ObligationClassId;
  readonly kind: InstrumentKind;
  readonly authorityLevel: AuthorityLevel;
  readonly title: string;
  readonly clauseRef: string | null;
  readonly effectiveDate: string | null;
  readonly verificationStatus: VerificationStatus;
  /** Gated by the finding's evidence level against the instrument's assertion floor. */
  readonly assertion: CitationAssertion;
  /**
   * True only when the citation is BOTH evidence-asserted AND independently
   * verified. With the UNVERIFIED seed this is always false — honest by design.
   */
  readonly defensible: boolean;
  /** Short, auditor-facing reason for the assertion level. */
  readonly rationale: string;
}

/**
 * Compute the assertion level for an instrument given the finding's evidence.
 *  - `asserted`  : evidence ≥ the instrument kind's assertion floor.
 *  - `referenced`: evidence is present but below the assertion floor (named, flagged).
 *  - `withheld`  : no admissible evidence (caller omits it).
 */
export function citationAssertionFor(
  kind: InstrumentKind,
  evidenceLevel: EvidenceLevel,
): CitationAssertion {
  if (evidenceLevel === 'NONE') return 'withheld';
  return isAtLeast(evidenceLevel, ASSERTION_FLOOR_BY_KIND[kind]) ? 'asserted' : 'referenced';
}

/** Build a single, fully-gated Citation from an instrument + evidence level. */
export function buildCitation(
  instrument: SourceInstrument,
  evidenceLevel: EvidenceLevel,
): Citation {
  const assertion = citationAssertionFor(instrument.kind, evidenceLevel);
  const verified = isVerifiedAtLeast(instrument.verificationStatus, 'VALIDATOR_CONFIRMED');
  const defensible = assertion === 'asserted' && verified;

  const rationale =
    assertion === 'asserted'
      ? verified
        ? 'Evidence meets the assertion floor and the instrument is validator-confirmed.'
        : 'Evidence meets the assertion floor, but the instrument reference is UNVERIFIED — present as candidate, not authority.'
      : assertion === 'referenced'
        ? `Named as a candidate source; evidence is below the ${ASSERTION_FLOOR_BY_KIND[instrument.kind]} floor required to assert this ${instrument.kind}.`
        : 'No admissible evidence to surface this source.';

  return Object.freeze({
    instrumentId: instrument.id,
    obligationClass: instrument.obligationClass,
    kind: instrument.kind,
    authorityLevel: instrument.authorityLevel,
    title: instrument.title,
    clauseRef: instrument.clauseRef,
    effectiveDate: instrument.effectiveDate,
    verificationStatus: instrument.verificationStatus,
    assertion,
    defensible,
    rationale,
  });
}
