/**
 * ARTIFACT TYPE: Runtime Identity — Alias Map
 * MODULE: OCI ↔ OCRA Convergence
 * DOCTRINE_VERSION: 1.0.0
 *
 * Single source of truth for ICRA ↔ OCRA equivalence across runtime surfaces:
 * routes, environment variables, Stripe price keys, HubSpot field IDs, and
 * database tables.
 *
 * Posture:
 *   - Read-only.
 *   - The OCRA form is canonical; the ICRA form is legacy.
 *   - This map describes equivalence; it never rotates upstream values.
 */

export const IDENTITY_ALIAS_MAP_VERSION = '1.0.0' as const;

export interface AliasPair {
  readonly legacy: string;
  readonly canonical: string;
}

/** HTTP route prefixes that flow through the compatibility layer. */
export const ROUTE_ALIASES: readonly AliasPair[] = [
  { legacy: '/api/icra', canonical: '/api/ocra' },
  { legacy: '/api/icra/assessments', canonical: '/api/ocra/assessments' },
  { legacy: '/api/icra/profile', canonical: '/api/ocra/profile' },
  { legacy: '/api/icra/claim', canonical: '/api/ocra/claim' },
  { legacy: '/api/icra/report', canonical: '/api/ocra/report' },
];

/** Environment variable prefixes/names. */
export const ENV_VAR_ALIASES: readonly AliasPair[] = [
  { legacy: 'ICRA_DATABASE_URL', canonical: 'OCRA_DATABASE_URL' },
  { legacy: 'ICRA_REPORT_BUCKET', canonical: 'OCRA_REPORT_BUCKET' },
  { legacy: 'ICRA_CLAIM_TOKEN_SECRET', canonical: 'OCRA_CLAIM_TOKEN_SECRET' },
  { legacy: 'ICRA_FEATURE_FLAGS', canonical: 'OCRA_FEATURE_FLAGS' },
  { legacy: 'ICRA_PUBLIC_ENDPOINT', canonical: 'OCRA_PUBLIC_ENDPOINT' },
];

/** Stripe price keys exposed at the integration layer. */
export const STRIPE_PRICE_ALIASES: readonly AliasPair[] = [
  { legacy: 'stripe_price_icra_standard', canonical: 'stripe_price_ocra_standard' },
  { legacy: 'stripe_price_icra_pilot', canonical: 'stripe_price_ocra_pilot' },
  { legacy: 'stripe_price_icra_institutional', canonical: 'stripe_price_ocra_institutional' },
];

/** HubSpot property internal names. */
export const HUBSPOT_PROPERTY_ALIASES: readonly AliasPair[] = [
  { legacy: 'icra_maturity_band', canonical: 'ocra_maturity_band' },
  { legacy: 'icra_composite_score', canonical: 'ocra_composite_score' },
  { legacy: 'icra_assessment_id', canonical: 'ocra_assessment_id' },
];

/** Database table aliases. Persisted DB column rename is out of scope. */
export const DB_TABLE_ALIASES: readonly AliasPair[] = [
  { legacy: 'icra_organizations', canonical: 'ocra_organizations' },
  { legacy: 'icra_assessments', canonical: 'ocra_assessments' },
  { legacy: 'icra_assessment_answers', canonical: 'ocra_assessment_answers' },
  { legacy: 'icra_maturity_profiles', canonical: 'ocra_maturity_profiles' },
  { legacy: 'icra_continuity_scores', canonical: 'ocra_continuity_scores' },
  { legacy: 'icra_governance_flags', canonical: 'ocra_governance_flags' },
];

/** All alias categories in one place, for audit and inspection. */
export const ALL_ALIAS_CATEGORIES = {
  route: ROUTE_ALIASES,
  envVar: ENV_VAR_ALIASES,
  stripePrice: STRIPE_PRICE_ALIASES,
  hubspotProperty: HUBSPOT_PROPERTY_ALIASES,
  dbTable: DB_TABLE_ALIASES,
} as const;

export type AliasCategory = keyof typeof ALL_ALIAS_CATEGORIES;
