/**
 * ARTIFACT TYPE: Organizational Profile Lens
 * MODULE: OCRA Dynamic Questionnaire Adaptation
 * DOCTRINE: OCI_ADAPTIVE_ASSESSMENT_DOCTRINE.md §6
 *
 * Pure utilities for projecting an `InstitutionalAssessmentProfile` into the
 * predicates used by routing, scoring, and narrative engines. Keeps all
 * profile-aware decisions in one auditable surface.
 */

import type {
  ContinuityComplexity,
  ContinuityExposure,
  GovernanceComplexity,
  InstitutionalAssessmentProfile,
  InstitutionalScale,
  RespondentLens,
} from './types';

// ── Stable boolean lenses (used by routing engine in Part 3) ───────────────

export function isSmallScale(scale: InstitutionalScale): boolean {
  return scale === 'micro' || scale === 'small';
}

export function isLargeScale(scale: InstitutionalScale): boolean {
  return scale === 'large' || scale === 'enterprise' || scale === 'federated_complex';
}

export function isFederated(profile: InstitutionalAssessmentProfile): boolean {
  return (
    profile.institutionalScale === 'federated_complex' ||
    profile.governanceComplexity === 'federated'
  );
}

export function isPublicAccountability(
  profile: InstitutionalAssessmentProfile,
): boolean {
  return (
    profile.governanceComplexity === 'public_accountability' ||
    profile.continuityExposure === 'public_trust' ||
    profile.continuityExposure === 'mission_critical'
  );
}

export function isExternalRespondent(lens: RespondentLens): boolean {
  return lens === 'external_advisor' || lens === 'legal_or_counsel';
}

// ── Profile field equality helper (used by AdaptiveRules predicates) ──────

const PROFILE_FIELDS = [
  'institutionalScale',
  'continuityComplexity',
  'governanceComplexity',
  'continuityExposure',
  'respondentLens',
] as const;

export type ProfileFieldName = (typeof PROFILE_FIELDS)[number];

export function getProfileFieldValue(
  profile: InstitutionalAssessmentProfile,
  field: ProfileFieldName,
):
  | InstitutionalScale
  | ContinuityComplexity
  | GovernanceComplexity
  | ContinuityExposure
  | RespondentLens {
  switch (field) {
    case 'institutionalScale':
      return profile.institutionalScale;
    case 'continuityComplexity':
      return profile.continuityComplexity;
    case 'governanceComplexity':
      return profile.governanceComplexity;
    case 'continuityExposure':
      return profile.continuityExposure;
    case 'respondentLens':
      return profile.respondentLens;
  }
}

/**
 * Compact, deterministic, low-cardinality summary string used in telemetry
 * and facilitator displays. Never includes free text, org name, sector
 * specifics, or anything that could re-identify an assessment.
 */
export function profileBandSummary(
  profile: InstitutionalAssessmentProfile,
): string {
  return [
    profile.institutionalScale,
    profile.continuityComplexity,
    profile.governanceComplexity,
    profile.continuityExposure,
    profile.respondentLens,
  ].join('|');
}
