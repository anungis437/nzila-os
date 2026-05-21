/**
 * ARTIFACT TYPE: Intelligence Contract
 * MODULE: OCI Intelligence Network
 * DOCTRINE_VERSION: 1.0.0
 *
 * Longitudinal continuity intelligence contracts for Product 5.
 *
 * These contracts shape what flows between OCI intelligence engines. They are
 * intentionally narrow and anti-surveillance by construction.
 *
 * Posture:
 *   - Anonymised by default. Institutions are referenced through opaque
 *     `institutionRefHash` values; the network never receives institution names.
 *   - Reviewer-led. Every record carries a `reviewerRefId` so the human author
 *     of the underlying reading remains traceable inside the institution that
 *     produced it.
 *   - K-anonymous. Aggregations refuse to return cohorts below a configured
 *     minimum participant count.
 *   - Refusal-first. Missing or insufficient data resolves to
 *     `not_yet_readable`. The network never invents a trajectory.
 *   - Non-ranking. No contract carries a comparative score, percentile, rank,
 *     or peer-relative position.
 */

export const INTELLIGENCE_CONTRACT_VERSION = '1.0.0' as const;

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bands used across longitudinal contracts. Always include `not_yet_readable`
 * so refusal is a first-class outcome.
 */
export type ContinuityTrajectoryBand =
  | 'not_yet_readable'
  | 'holding'
  | 'stabilizing'
  | 'regressing';

export type GovernanceDriftBand =
  | 'not_yet_readable'
  | 'stabilizing'
  | 'holding'
  | 'regressing';

export type StewardshipEvolutionBand =
  | 'not_yet_readable'
  | 'redistributing'
  | 'holding'
  | 'reconcentrating';

export type SurvivabilityProgressionBand =
  | 'not_yet_readable'
  | 'strengthening'
  | 'holding'
  | 'weakening';

export type ContinuityDebtTrend =
  | 'not_yet_readable'
  | 'reducing'
  | 'holding'
  | 'accumulating';

export type InstitutionalResilienceBand =
  | 'not_yet_readable'
  | 'persisting'
  | 'holding'
  | 'eroding';

/**
 * Sectors recognised by the network. Sectors are intentionally coarse so the
 * network cannot infer specific institutions from sector membership alone.
 */
export type IntelligenceSector =
  | 'labour_union'
  | 'federated_organization'
  | 'healthcare'
  | 'nonprofit_advocacy'
  | 'regulatory_governance'
  | 'membership_organization';

// ─────────────────────────────────────────────────────────────────────────────
// Anonymisation handle
//
// `institutionRefHash` is the only handle the network ever sees. It is an
// opaque, stable, salted hash produced by the contributing institution. The
// network has no inverse mapping back to institution identity.
// ─────────────────────────────────────────────────────────────────────────────

export interface AnonymisedInstitutionHandle {
  readonly institutionRefHash: string;
  readonly sector: IntelligenceSector;
  readonly contributedAt: string; // ISO-8601
}

// ─────────────────────────────────────────────────────────────────────────────
// ContinuityTrajectoryRecord
//
// A single longitudinal reading of an institution's continuity posture. The
// record carries no narrative content; it is a deterministic shape only.
// ─────────────────────────────────────────────────────────────────────────────

export interface ContinuityTrajectoryRecord {
  readonly trajectoryId: string;
  readonly handle: AnonymisedInstitutionHandle;
  readonly observedAt: string; // ISO-8601
  readonly band: ContinuityTrajectoryBand;
  readonly reviewerRefId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// GovernanceEntropyDriftRecord
//
// Successive readings of governance entropy. The record is intentionally
// expressed as a drift band rather than a numeric entropy score.
// ─────────────────────────────────────────────────────────────────────────────

export interface GovernanceEntropyDriftRecord {
  readonly driftId: string;
  readonly handle: AnonymisedInstitutionHandle;
  readonly observedAt: string; // ISO-8601
  readonly drift: GovernanceDriftBand;
  readonly reviewerRefId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// StewardshipEvolutionRecord
//
// A reading of stewardship concentration evolution.
// ─────────────────────────────────────────────────────────────────────────────

export interface StewardshipEvolutionRecord {
  readonly evolutionId: string;
  readonly handle: AnonymisedInstitutionHandle;
  readonly observedAt: string; // ISO-8601
  readonly evolution: StewardshipEvolutionBand;
  readonly reviewerRefId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SurvivabilityProgressionRecord
//
// Onboarding survivability readings over time.
// ─────────────────────────────────────────────────────────────────────────────

export interface SurvivabilityProgressionRecord {
  readonly progressionId: string;
  readonly handle: AnonymisedInstitutionHandle;
  readonly observedAt: string; // ISO-8601
  readonly progression: SurvivabilityProgressionBand;
  readonly reviewerRefId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ContinuityDebtEvolutionRecord
//
// A reading of continuity debt evolution.
// ─────────────────────────────────────────────────────────────────────────────

export interface ContinuityDebtEvolutionRecord {
  readonly debtId: string;
  readonly handle: AnonymisedInstitutionHandle;
  readonly observedAt: string; // ISO-8601
  readonly trend: ContinuityDebtTrend;
  readonly reviewerRefId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SectorBaselineEnvelope
//
// An aggregated reading describing the continuity posture of a sector. The
// envelope NEVER carries institution handles. It only carries the count of
// contributing institutions, which must satisfy the network k-anonymity floor.
// ─────────────────────────────────────────────────────────────────────────────

export interface SectorBaselineEnvelope {
  readonly baselineId: string;
  readonly sector: IntelligenceSector;
  readonly composedAt: string; // ISO-8601
  readonly contributingInstitutions: number;
  readonly trajectoryDistribution: Readonly<Record<ContinuityTrajectoryBand, number>>;
  readonly driftDistribution: Readonly<Record<GovernanceDriftBand, number>>;
  readonly stewardshipDistribution: Readonly<Record<StewardshipEvolutionBand, number>>;
  readonly survivabilityDistribution: Readonly<Record<SurvivabilityProgressionBand, number>>;
  readonly debtDistribution: Readonly<Record<ContinuityDebtTrend, number>>;
  readonly readable: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// InstitutionalResilienceSignal
//
// A composite, reviewer-readable signal describing the resilience reading the
// engine produced for an institution. Signals are read-only and always carry
// a reason so a reviewer can interpret them without leaving the institution.
// ─────────────────────────────────────────────────────────────────────────────

export interface InstitutionalResilienceSignal {
  readonly signalId: string;
  readonly band: InstitutionalResilienceBand;
  readonly reason: string;
  readonly observedAt: string; // ISO-8601
  readonly reviewerRefId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Network participation
//
// Participation is opt-in per institution and per record kind. The network
// rejects any record whose handle does not appear in the participation
// registry. Withdrawal removes the institution from future aggregations.
// ─────────────────────────────────────────────────────────────────────────────

export type ParticipationScope =
  | 'continuity_trajectory'
  | 'governance_drift'
  | 'stewardship_evolution'
  | 'survivability_progression'
  | 'continuity_debt';

export interface IntelligenceParticipationGrant {
  readonly institutionRefHash: string;
  readonly sector: IntelligenceSector;
  readonly grantedScopes: ReadonlyArray<ParticipationScope>;
  readonly grantedAt: string; // ISO-8601
  readonly reviewerRefId: string;
}
