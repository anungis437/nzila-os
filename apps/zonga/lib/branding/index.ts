/**
 * Zonga — Branding Module Barrel Export
 */

// Types
export type {
  BrandRole,
  BrandPlacement,
  BrandVisibilityMode,
  BrandPolicyRule,
  BrandAsset,
  BrandRegistryEntry,
  BrandRenderDirective,
  BrandingFeatureFlags,
} from './types'
export { DEFAULT_BRANDING_FLAGS } from './types'

// Policy Matrix
export {
  BRAND_POLICY_MATRIX,
  getPolicyRule,
  getVisiblePlacements,
  getForbiddenPlacements,
} from './placements'

// Enforcement
export {
  evaluateBrandPolicy,
  canRenderBrand,
  assertBrandPolicy,
  getSafeBrandMode,
  getWorkspaceDisplayName,
  detectWhiteLabelViolations,
  BrandPolicyViolation,
} from './policy'

// Feature Flags
export { loadBrandingFlags } from './feature-flags'

// Partnership
export type { AttributionLine, PartnershipAttribution } from './partnership'
export {
  buildAttribution,
  formatAttributionText,
  getPartnerRelationshipLabel,
  countVisibleExternalBrands,
} from './partnership'

// Registry
export {
  ZONGA_BRAND,
  registerBrand,
  getBrand,
  getPlatformBrand,
  getBrandsByRole,
  getPlacementOverride,
  isBrandRegistered,
  unregisterBrand,
  clearExternalBrands,
} from './registry'

// Brand Configuration
export {
  CLIENT_BRAND,
  PARTNER_BRAND,
  initializeBrands,
  getClientBrand,
  getPartnerBrand,
} from './brand-config'
