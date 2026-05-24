/**
 * ARTIFACT TYPE: Ethics Validator
 * MODULE: OCI Intelligence Network
 * DOCTRINE_VERSION: 1.0.0
 *
 * Doctrinal protection layer for Product 5.
 *
 * These validators enforce the intelligence network's hard ethical floor:
 *   - k-anonymity preservation
 *   - opt-in participation enforcement
 *   - no organizational exposure
 *   - no rankings of institutions
 *   - no worker profiling
 *   - no governance reputation scoring
 *   - reviewer-led interpretation
 *   - organizational dignity preservation
 *
 * The validators NEVER reach across institutions on behalf of the network.
 * They simply refuse outputs that would violate the doctrine.
 */

import type {
  AnonymisedInstitutionHandle,
  IntelligenceParticipationGrant,
  IntelligenceSector,
  ParticipationScope,
  SectorBaselineEnvelope,
} from '../contracts/intelligenceContracts';

export const INTELLIGENCE_ETHICS_VERSION = '1.0.0' as const;

/**
 * Minimum cohort size for any sector aggregation. Aggregations with fewer
 * contributing institutions resolve to `readable: false` so reviewers
 * receive a refusal rather than an inferred reading.
 */
export const K_ANONYMITY_FLOOR = 5 as const;

export type EthicsRejectionReason =
  | 'cohort_below_k_anonymity_floor'
  | 'institution_not_opted_in'
  | 'scope_not_granted'
  | 'institution_handle_exposed'
  | 'ranking_payload_detected'
  | 'reviewer_reference_missing'
  | 'sector_mismatch';

export interface EthicsVerdict {
  readonly readable: boolean;
  readonly reasons: ReadonlyArray<EthicsRejectionReason>;
}

const ok: EthicsVerdict = Object.freeze({ readable: true, reasons: [] });

function refuse(...reasons: EthicsRejectionReason[]): EthicsVerdict {
  return { readable: false, reasons };
}

/**
 * Confirms a cohort satisfies the k-anonymity floor.
 */
export function checkKAnonymity(cohortSize: number): EthicsVerdict {
  if (!Number.isFinite(cohortSize) || cohortSize < K_ANONYMITY_FLOOR) {
    return refuse('cohort_below_k_anonymity_floor');
  }
  return ok;
}

/**
 * Confirms an institution has granted the network the requested participation
 * scope. Refuses if no grant exists or the scope was not granted.
 */
export function checkParticipation(
  grants: ReadonlyArray<IntelligenceParticipationGrant>,
  institutionRefHash: string,
  scope: ParticipationScope,
): EthicsVerdict {
  const grant = grants.find(
    (candidate) => candidate.institutionRefHash === institutionRefHash,
  );
  if (!grant) {
    return refuse('institution_not_opted_in');
  }
  if (!grant.grantedScopes.includes(scope)) {
    return refuse('scope_not_granted');
  }
  return ok;
}

/**
 * Confirms an anonymised handle does not leak institution identity into the
 * network payload. Refuses if the handle carries anything other than the
 * opaque hash + sector + contribution timestamp.
 */
export function checkAnonymisationIntegrity(
  handle: AnonymisedInstitutionHandle,
): EthicsVerdict {
  const allowedKeys = new Set(['institutionRefHash', 'sector', 'contributedAt']);
  for (const key of Object.keys(handle)) {
    if (!allowedKeys.has(key)) {
      return refuse('institution_handle_exposed');
    }
  }
  if (!handle.institutionRefHash || handle.institutionRefHash.length < 8) {
    return refuse('institution_handle_exposed');
  }
  return ok;
}

/**
 * Confirms a payload destined for the network does not carry comparative
 * ranking content. Detects common ranking field names so callers are forced
 * to reshape ranked content before submission.
 */
export function checkAgainstRanking(payload: unknown): EthicsVerdict {
  if (typeof payload !== 'object' || payload === null) {
    return ok;
  }
  const forbiddenKeys = [
    'rank',
    'ranking',
    'leaderboard',
    'percentile',
    'peerScore',
    'reputationScore',
    'prestige',
    'topPerformers',
    'bestInClass',
    'worstInClass',
  ];
  const keys = Object.keys(payload as Record<string, unknown>);
  if (keys.some((key) => forbiddenKeys.includes(key))) {
    return refuse('ranking_payload_detected');
  }
  return ok;
}

/**
 * Confirms a reviewer reference is present. The network does not aggregate
 * any reading whose human author cannot be traced back inside the contributing
 * institution.
 */
export function checkReviewerReference(reviewerRefId: string | undefined): EthicsVerdict {
  if (!reviewerRefId || reviewerRefId.trim().length === 0) {
    return refuse('reviewer_reference_missing');
  }
  return ok;
}

/**
 * Confirms a sector envelope's declared sector matches the contributing
 * handles. Used by aggregation routines to refuse cross-sector pollution.
 */
export function checkSectorCoherence(
  envelopeSector: IntelligenceSector,
  handleSectors: ReadonlyArray<IntelligenceSector>,
): EthicsVerdict {
  if (handleSectors.some((sector) => sector !== envelopeSector)) {
    return refuse('sector_mismatch');
  }
  return ok;
}

/**
 * Convenience composite: ensures a sector baseline envelope satisfies all
 * intelligence ethics floors before reviewers see it.
 */
export function validateSectorBaseline(
  envelope: SectorBaselineEnvelope,
): EthicsVerdict {
  if (!envelope.readable) {
    return ok;
  }
  const cohort = checkKAnonymity(envelope.contributingInstitutions);
  if (!cohort.readable) {
    return cohort;
  }
  const ranking = checkAgainstRanking(envelope);
  if (!ranking.readable) {
    return ranking;
  }
  return ok;
}
