/**
 * ARTIFACT TYPE: Deterministic Complexity Model
 * MODULE: OCRA Dynamic Questionnaire Adaptation
 * DOCTRINE: OCI_ADAPTIVE_ASSESSMENT_DOCTRINE.md §3.2–§3.4
 *
 * Pure functions: same inputs → same outputs, always. No I/O, no logic that
 * inspects anything beyond the typed inputs.
 */

import type {
  ContinuityComplexity,
  ContinuityExposure,
  GovernanceComplexity,
  InstitutionalScale,
} from './types';

// ── institutionalScale ─────────────────────────────────────────────────────

const WORKFORCE_BAND_TO_SCALE: Record<
  'under_50' | '50_249' | '250_999' | '1000_4999' | '5000_plus',
  InstitutionalScale
> = {
  under_50: 'micro',
  '50_249': 'small',
  '250_999': 'mid_sized',
  '1000_4999': 'large',
  '5000_plus': 'enterprise',
};

export function resolveInstitutionalScale(
  workforceBand: keyof typeof WORKFORCE_BAND_TO_SCALE | undefined,
  hasFederationAffiliation: boolean,
): InstitutionalScale | undefined {
  if (!workforceBand) return undefined;
  const base = WORKFORCE_BAND_TO_SCALE[workforceBand];
  // §3.1.1: federation override promotes mid_sized+ to federated_complex.
  if (
    hasFederationAffiliation &&
    (base === 'mid_sized' || base === 'large' || base === 'enterprise')
  ) {
    return 'federated_complex';
  }
  return base;
}

// ── continuityComplexity ───────────────────────────────────────────────────

export type OrganizationAgeBand =
  | 'under_5_years'
  | '5_to_14_years'
  | '15_to_29_years'
  | '30_plus_years';

export function resolveContinuityComplexity(
  scale: InstitutionalScale | undefined,
  ageBand: OrganizationAgeBand | undefined,
): ContinuityComplexity | undefined {
  if (!scale) return undefined;
  if (scale === 'federated_complex') return 'institutional';
  if (scale === 'large' || scale === 'enterprise') return 'high';
  if (scale === 'mid_sized') return 'elevated';

  // micro / small split by age — younger, smaller orgs read as low complexity.
  if (scale === 'micro') {
    if (ageBand === 'under_5_years') return 'low';
    if (ageBand === '5_to_14_years') return 'moderate';
    if (ageBand === '15_to_29_years' || ageBand === '30_plus_years') return 'elevated';
    return 'low';
  }
  if (scale === 'small') {
    if (ageBand === 'under_5_years') return 'low';
    if (ageBand === '5_to_14_years' || ageBand === '15_to_29_years') return 'moderate';
    if (ageBand === '30_plus_years') return 'elevated';
    return 'moderate';
  }
  return undefined;
}

// ── governanceComplexity ───────────────────────────────────────────────────

export function resolveGovernanceComplexity(
  governanceModel:
    | 'elected_board'
    | 'appointed_board'
    | 'hybrid'
    | 'other'
    | undefined,
  scale: InstitutionalScale | undefined,
  hasFederationAffiliation: boolean,
): GovernanceComplexity | undefined {
  if (hasFederationAffiliation) return 'federated';
  if (governanceModel === 'appointed_board') return 'public_accountability';
  if (governanceModel === 'elected_board') {
    if (scale === 'mid_sized' || scale === 'large' || scale === 'enterprise') {
      return 'multi_layer';
    }
    return 'structured';
  }
  if (governanceModel === 'hybrid') return 'multi_layer';
  if (governanceModel === 'other') return 'simple';
  return undefined;
}

// ── continuityExposure ─────────────────────────────────────────────────────

const MISSION_CRITICAL_SECTORS = new Set([
  'healthcare',
  'social_services',
  'public_safety',
]);

const PUBLIC_TRUST_SECTORS = new Set([
  'public_sector',
  'government',
  'education',
  'crown_corporation',
]);

const CROSS_FUNCTIONAL_SECTORS = new Set([
  'labour_union',
  'nonprofit',
  'cooperative',
  'community',
]);

export function resolveContinuityExposure(
  sector: string | undefined,
  scale: InstitutionalScale | undefined,
): ContinuityExposure | undefined {
  if (!sector) {
    // Fallback by scale: a federated_complex org without a sector still has
    // multi-site exposure by virtue of its federation structure.
    if (scale === 'federated_complex') return 'multi_site';
    return undefined;
  }
  if (MISSION_CRITICAL_SECTORS.has(sector)) return 'mission_critical';
  if (PUBLIC_TRUST_SECTORS.has(sector)) return 'public_trust';
  if (CROSS_FUNCTIONAL_SECTORS.has(sector)) return 'cross_functional';
  if (scale === 'federated_complex' || scale === 'enterprise') return 'multi_site';
  return 'localized';
}

// ── Comparable ordering (used by min/max ContinuityComplexity rules) ───────

const COMPLEXITY_ORDER: ReadonlyArray<ContinuityComplexity> = [
  'low',
  'moderate',
  'elevated',
  'high',
  'institutional',
];

export function complexityRank(value: ContinuityComplexity): number {
  return COMPLEXITY_ORDER.indexOf(value);
}

export function complexityAtLeast(
  candidate: ContinuityComplexity,
  minimum: ContinuityComplexity,
): boolean {
  return complexityRank(candidate) >= complexityRank(minimum);
}

export function complexityAtMost(
  candidate: ContinuityComplexity,
  maximum: ContinuityComplexity,
): boolean {
  return complexityRank(candidate) <= complexityRank(maximum);
}
