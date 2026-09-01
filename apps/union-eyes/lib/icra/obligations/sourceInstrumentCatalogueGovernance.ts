/**
 * ARTIFACT TYPE: Government-Readiness Additive Layer — Source-Instrument Catalogue Governance
 * MODULE: OCI/OCRA Catalogue lifecycle, versioning, jurisdiction selection, conflict handling (Gap 4)
 * DOCTRINE: docs/oci/superseded/government-readiness/OCI_OCRA_SOURCE_INSTRUMENT_TRACEABILITY.md
 *
 * Once OCI/OCRA names a *specific* instrument ("which Act? which policy?"), the
 * unavoidable governance question is: **who decides which legislation counts, and
 * how does that decision stay auditable over time?** This module answers it as an
 * explicit, testable discipline rather than an undocumented editorial habit.
 *
 * It governs five operations the doctrine calls out:
 *   1. Adding instruments        — a strict lifecycle state machine.
 *   2. Retiring instruments      — withdrawal is a tracked transition, never a delete.
 *   3. Versioning instruments    — every amendment bumps a recorded catalogue version.
 *   4. Jurisdiction selection    — which instruments apply to a given government tier.
 *   5. Conflict handling         — name the tension, lead by authority, never auto-net.
 *
 * SAFETY CONSTITUTION (non-negotiable):
 *   - Reference/governance data only. NEVER imports the scoring engine; can never
 *     influence a dimension, composite, or maturity band.
 *   - Decisions are attributed to a ROLE, never to a named person (anti-surveillance).
 *   - Conflicts are NAMED and led by authority level; tied authority requires human
 *     arbitration (consistent with the obligation doctrine's "name it, don't net it").
 *   - Nothing is ever silently deleted: supersession and retirement are recorded
 *     transitions that preserve the audit trail.
 */

import type { ObligationClassId } from './obligationTaxonomy';
import {
  authorityLevelForKind,
  type AuthorityLevel,
  type Jurisdiction,
  type SourceInstrument,
  type VerificationStatus,
} from './sourceInstruments';

export const CATALOGUE_GOVERNANCE_VERSION = '1.0.0';

// ─────────────────────────────────────────────────────────────────────────────
// 1–2. Lifecycle state machine (adding / retiring)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lifecycle of a single catalogue entry. The catalogue grows and ages through
 * these states only; any other movement is illegal and rejected.
 */
export type CatalogueLifecycleState =
  | 'proposed' // suggested, not yet admitted to the active catalogue
  | 'candidate' // in the active catalogue; surfaced as `referenced`, never asserted
  | 'confirmed' // validator-confirmed; may be asserted at/above its evidence floor
  | 'superseded' // replaced by a newer instrument/version; retained for audit
  | 'retired'; // withdrawn; must never be surfaced again

/** Allowed forward transitions. Everything not listed here is rejected. */
const LIFECYCLE_TRANSITIONS: Record<
  CatalogueLifecycleState,
  readonly CatalogueLifecycleState[]
> = Object.freeze({
  proposed: ['candidate', 'retired'],
  candidate: ['confirmed', 'superseded', 'retired'],
  confirmed: ['superseded', 'retired'],
  superseded: ['retired'],
  retired: [],
});

export function canTransition(
  from: CatalogueLifecycleState,
  to: CatalogueLifecycleState,
): boolean {
  return LIFECYCLE_TRANSITIONS[from].includes(to);
}

export class CatalogueGovernanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogueGovernanceError';
  }
}

export function assertTransition(
  from: CatalogueLifecycleState,
  to: CatalogueLifecycleState,
): void {
  if (!canTransition(from, to)) {
    throw new CatalogueGovernanceError(
      `Illegal catalogue lifecycle transition: "${from}" → "${to}". ` +
        `Allowed from "${from}": [${LIFECYCLE_TRANSITIONS[from].join(', ') || 'none'}].`,
    );
  }
}

/**
 * The verification status a given lifecycle state is consistent with. Used to
 * keep the lifecycle and the instrument's `verificationStatus` from drifting
 * apart (a `confirmed` entry must not still be `UNVERIFIED`).
 */
export function verificationConsistentWith(
  state: CatalogueLifecycleState,
  status: VerificationStatus,
): boolean {
  switch (state) {
    case 'proposed':
    case 'candidate':
      return status === 'UNVERIFIED';
    case 'confirmed':
      return status === 'VALIDATOR_CONFIRMED' || status === 'AUTHORITATIVE';
    case 'superseded':
    case 'retired':
      // Historical states may carry whatever status they held when frozen.
      return true;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Versioning + amendment records
// ─────────────────────────────────────────────────────────────────────────────

/** Roles permitted to amend the catalogue. Never a person; always a role. */
export type GovernanceRole =
  | 'catalogue_steward'
  | 'validator'
  | 'legal_counsel'
  | 'calibration_authority';

export type AmendmentKind =
  | 'add' // introduce a new proposed/candidate instrument
  | 'promote' // candidate → confirmed (validator/counsel confirmed)
  | 'supersede' // candidate/confirmed → superseded by a newer instrument
  | 'retire' // withdraw an instrument
  | 'reclassify'; // correct kind/jurisdiction/authority of an existing entry

/** Which roles may decide each amendment kind. */
const AMENDMENT_AUTHORITY: Record<AmendmentKind, readonly GovernanceRole[]> = Object.freeze({
  add: ['catalogue_steward', 'validator', 'legal_counsel'],
  promote: ['validator', 'legal_counsel'],
  supersede: ['validator', 'legal_counsel'],
  retire: ['catalogue_steward', 'validator', 'legal_counsel'],
  reclassify: ['catalogue_steward', 'validator', 'legal_counsel'],
});

export function roleMayDecide(role: GovernanceRole, kind: AmendmentKind): boolean {
  return AMENDMENT_AUTHORITY[kind].includes(role);
}

/**
 * An immutable record of one catalogue change. Every amendment names the role
 * that decided it, the lifecycle movement, and the catalogue version before and
 * after. This is the audit trail a regulator asks for.
 */
export interface CatalogueAmendment {
  readonly amendmentId: string;
  readonly instrumentId: string;
  readonly kind: AmendmentKind;
  /** `null` only for an `add` (the entry did not exist before). */
  readonly fromState: CatalogueLifecycleState | null;
  readonly toState: CatalogueLifecycleState;
  readonly catalogueVersionBefore: string;
  readonly catalogueVersionAfter: string;
  readonly rationale: string;
  readonly decidedByRole: GovernanceRole;
  /** ISO-8601 timestamp, caller-supplied (injectable for deterministic tests). */
  readonly decidedAt: string;
}

interface VersionParts {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly suffix: string;
}

function parseVersion(version: string): VersionParts {
  const match = /^(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?$/.exec(version);
  if (!match) {
    throw new CatalogueGovernanceError(`Unparseable catalogue version: "${version}".`);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    suffix: match[4] ?? '',
  };
}

/**
 * Bump the catalogue version for an amendment. Every amendment is a content
 * change, so each bumps the minor version and resets patch. The pre-release
 * suffix (e.g. `-unverified`) is preserved until a steward clears it once no
 * candidate entry remains UNVERIFIED.
 */
export function bumpCatalogueVersion(current: string, _kind: AmendmentKind): string {
  const { major, minor, suffix } = parseVersion(current);
  return `${major}.${minor + 1}.0${suffix}`;
}

/**
 * Build (and validate) an amendment record. Throws if the role is not permitted
 * to make this kind of change, or if the lifecycle movement is illegal.
 */
export function recordAmendment(input: {
  readonly amendmentId: string;
  readonly instrumentId: string;
  readonly kind: AmendmentKind;
  readonly fromState: CatalogueLifecycleState | null;
  readonly toState: CatalogueLifecycleState;
  readonly catalogueVersionBefore: string;
  readonly rationale: string;
  readonly decidedByRole: GovernanceRole;
  readonly decidedAt: string;
}): CatalogueAmendment {
  if (!roleMayDecide(input.decidedByRole, input.kind)) {
    throw new CatalogueGovernanceError(
      `Role "${input.decidedByRole}" may not decide a "${input.kind}" amendment.`,
    );
  }
  if (input.kind === 'add') {
    if (input.fromState !== null) {
      throw new CatalogueGovernanceError('An "add" amendment must have fromState = null.');
    }
    if (input.toState !== 'proposed' && input.toState !== 'candidate') {
      throw new CatalogueGovernanceError(
        'An "add" amendment must target "proposed" or "candidate".',
      );
    }
  } else {
    if (input.fromState === null) {
      throw new CatalogueGovernanceError(
        `A "${input.kind}" amendment requires a non-null fromState.`,
      );
    }
    assertTransition(input.fromState, input.toState);
  }
  if (input.rationale.trim().length === 0) {
    throw new CatalogueGovernanceError('Every amendment requires a non-empty rationale.');
  }

  return Object.freeze({
    amendmentId: input.amendmentId,
    instrumentId: input.instrumentId,
    kind: input.kind,
    fromState: input.fromState,
    toState: input.toState,
    catalogueVersionBefore: input.catalogueVersionBefore,
    catalogueVersionAfter: bumpCatalogueVersion(input.catalogueVersionBefore, input.kind),
    rationale: input.rationale,
    decidedByRole: input.decidedByRole,
    decidedAt: input.decidedAt,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Jurisdiction selection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bands that apply regardless of the government tier in context: sector standards,
 * institution-internal instruments, and unspecified placeholders are always
 * candidates for selection.
 */
const ALWAYS_APPLICABLE: ReadonlySet<Jurisdiction> = new Set<Jurisdiction>([
  'sector_standard',
  'institutional',
  'unspecified',
]);

/**
 * Select the instruments applicable to a government tier. An instrument applies
 * if its jurisdiction exactly matches the context, or it is in an always-applicable
 * band. Deterministic: preserves input order. Never mutates the input.
 */
export function selectApplicableInstruments(
  instruments: readonly SourceInstrument[],
  context: Jurisdiction,
): readonly SourceInstrument[] {
  return instruments.filter(
    (i) => i.jurisdiction === context || ALWAYS_APPLICABLE.has(i.jurisdiction),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Conflict handling
// ─────────────────────────────────────────────────────────────────────────────

/** Authority levels ordered strongest → weakest. Index 0 is the strongest. */
export const AUTHORITY_ORDER: readonly AuthorityLevel[] = Object.freeze([
  'primary_legislation',
  'subordinate_legislation',
  'binding_executive_policy',
  'binding_institutional',
  'advisory_standard',
]);

/** Rank of an authority level; lower is stronger. */
export function authorityRank(level: AuthorityLevel): number {
  return AUTHORITY_ORDER.indexOf(level);
}

/** True when `a` carries strictly greater legal force than `b`. */
export function isStrongerAuthority(a: AuthorityLevel, b: AuthorityLevel): boolean {
  return authorityRank(a) < authorityRank(b);
}

/**
 * A named conflict: two or more instruments claim to source the SAME obligation
 * class in the SAME jurisdiction. The conflict is reported, not silently
 * resolved — the lead is the strongest-authority instrument, and a tie at the
 * top requires human arbitration (the system refuses to auto-net duties).
 */
export interface InstrumentConflict {
  readonly obligationClass: ObligationClassId;
  readonly jurisdiction: Jurisdiction;
  readonly instrumentIds: readonly string[];
  readonly leadInstrumentId: string;
  readonly requiresHumanArbitration: boolean;
  readonly rationale: string;
}

/**
 * Detect conflicts across a set of instruments. Groups by
 * `obligationClass + jurisdiction`; any group with more than one instrument is a
 * conflict. The lead is the strongest authority; if two or more instruments
 * share the strongest authority, `requiresHumanArbitration` is true.
 *
 * Deterministic: groups and instrument ids are sorted; ties broken by id.
 */
export function detectInstrumentConflicts(
  instruments: readonly SourceInstrument[],
): readonly InstrumentConflict[] {
  const groups = new Map<string, SourceInstrument[]>();
  for (const instrument of instruments) {
    const key = `${instrument.obligationClass}\u0000${instrument.jurisdiction}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(instrument);
    else groups.set(key, [instrument]);
  }

  const conflicts: InstrumentConflict[] = [];
  for (const bucket of groups.values()) {
    if (bucket.length < 2) continue;

    const sorted = [...bucket].sort((a, b) => {
      const rankDelta = authorityRank(a.authorityLevel) - authorityRank(b.authorityLevel);
      if (rankDelta !== 0) return rankDelta;
      return a.id.localeCompare(b.id);
    });

    const topRank = authorityRank(sorted[0]!.authorityLevel);
    const topCount = sorted.filter(
      (i) => authorityRank(i.authorityLevel) === topRank,
    ).length;
    const requiresHumanArbitration = topCount > 1;

    conflicts.push({
      obligationClass: sorted[0]!.obligationClass,
      jurisdiction: sorted[0]!.jurisdiction,
      instrumentIds: sorted.map((i) => i.id),
      leadInstrumentId: sorted[0]!.id,
      requiresHumanArbitration,
      rationale: requiresHumanArbitration
        ? `Multiple instruments share the strongest authority level ` +
          `(${sorted[0]!.authorityLevel}) for this obligation in this jurisdiction; ` +
          `a human must arbitrate which governs.`
        : `Lead instrument "${sorted[0]!.id}" carries the strongest authority ` +
          `(${sorted[0]!.authorityLevel}); lower-authority instruments are named, not netted.`,
    });
  }

  return Object.freeze(
    conflicts.sort((a, b) => {
      const classDelta = a.obligationClass.localeCompare(b.obligationClass);
      if (classDelta !== 0) return classDelta;
      return a.jurisdiction.localeCompare(b.jurisdiction);
    }),
  );
}

/**
 * Convenience: derive the authority level a not-yet-classified instrument would
 * carry from its kind, for use when staging an `add` amendment.
 */
export { authorityLevelForKind };
