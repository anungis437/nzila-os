/**
 * ARTIFACT TYPE: Pure Mapper
 * DOCTRINE_VERSION: 1.0.0
 *
 * Bridges the form-submitted `ctx_*` keyed shape (Record<string, string>)
 * to the canonical `OrganizationContext` interface consumed by the PDF
 * mapper and persona detector. The two shapes drifted historically; this
 * file is the single source of truth for that translation.
 *
 * Pure: no I/O, no side effects, no logging. Safe to call from server or client.
 */

import type { OrganizationContext } from './types';

/** Subset of org-type values that map to specific persona / governance hints. */
const UNION_LIKE_ORG_TYPES = new Set([
  'local_union',
  'national_union',
  'federation',
  'clc_affiliate',
  'guild',
]);

const APPOINTED_BOARD_ORG_TYPES = new Set([
  'crown_corp',
  'government_agency',
  'school_board',
  'health_authority',
  'municipality',
]);

const ELECTED_BOARD_ORG_TYPES = new Set([
  'local_union',
  'national_union',
  'federation',
  'clc_affiliate',
  'indigenous_gov',
  'cooperative',
]);

const FEDERATION_ORG_TYPES = new Set([
  'federation',
  'clc_affiliate',
  'industry_association',
]);

/** Map raw ctx_membership_size band to the canonical workforceBand union. */
function mapMembershipSizeToWorkforceBand(
  size: string | undefined,
): OrganizationContext['workforceBand'] | undefined {
  switch (size) {
    case 'under_100':
    case '100_499':
      return 'under_50';
    case '500_1999':
      return '50_249';
    case '2000_9999':
      return '250_999';
    case '10000_49999':
      return '1000_4999';
    case '50000_plus':
      return '5000_plus';
    default:
      return undefined;
  }
}

/**
 * Project the form-submitted `ctx_*` shape (or a stored organizationContext
 * JSON blob) onto the canonical OrganizationContext interface.
 *
 * Accepts either a raw Record<string, string> (the live form shape), an
 * already-canonical OrganizationContext, or null/undefined. Never throws.
 */
export function mapCtxToOrganizationContext(
  raw: Record<string, unknown> | OrganizationContext | null | undefined,
): OrganizationContext | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  // Detect whether this is already canonical (no ctx_* keys present and at
  // least one canonical key present).
  const hasCtxKeys = Object.keys(r).some((k) => k.startsWith('ctx_'));
  if (!hasCtxKeys) {
    return raw as OrganizationContext;
  }

  const orgType = typeof r.ctx_org_type === 'string' ? r.ctx_org_type : undefined;
  const sector = typeof r.ctx_sector === 'string' ? r.ctx_sector : undefined;
  const size = typeof r.ctx_membership_size === 'string' ? r.ctx_membership_size : undefined;

  const governanceModel: OrganizationContext['governanceModel'] = orgType
    ? APPOINTED_BOARD_ORG_TYPES.has(orgType)
      ? 'appointed_board'
      : ELECTED_BOARD_ORG_TYPES.has(orgType)
        ? 'elected_board'
        : 'other'
    : undefined;

  const federationAffiliation =
    orgType && FEDERATION_ORG_TYPES.has(orgType) ? orgType : undefined;

  return {
    sector,
    workforceBand: mapMembershipSizeToWorkforceBand(size),
    governanceModel,
    federationAffiliation,
    // name / jurisdiction are intentionally left unset — the intake form is
    // pseudonymous by design and does not collect either field.
  };
}

/** Convenience predicate for routes that want to detect a union-shaped org. */
export function isUnionLikeOrgType(orgType: string | undefined): boolean {
  return Boolean(orgType && UNION_LIKE_ORG_TYPES.has(orgType));
}
