/**
 * Zonga — Branding & Partnership Governance Types
 *
 * Canonical type definitions for the brand hierarchy:
 *   Zonga (platform) > Client (deployment) > Partner (distribution)
 *
 * @module @zonga/branding/types
 */

// ── Brand Roles ─────────────────────────────────────────────────────────────

/**
 * The three-tier brand hierarchy.
 *
 * - `platform`  — Zonga itself. Owns the product.
 * - `client`    — Deployment context (workspace tenant).
 * - `partner`   — Strategic / implementation layer (distribution).
 */
export type BrandRole = 'platform' | 'client' | 'partner'

// ── Placement Types ─────────────────────────────────────────────────────────

/**
 * Every surface where brand assets may appear.
 * New placements must be added here and have a policy entry.
 */
export type BrandPlacement =
  | 'app_header'
  | 'app_sidebar'
  | 'app_dashboard'
  | 'login'
  | 'onboarding'
  | 'workspace_label'
  | 'footer'
  | 'about'
  | 'support'
  | 'marketing_hero'
  | 'marketing_trust'
  | 'marketing_partnership'
  | 'marketing_case_study'

// ── Visibility Modes ────────────────────────────────────────────────────────

/**
 * How a brand asset is rendered.
 * Ordered from most visible to least visible.
 */
export type BrandVisibilityMode =
  | 'logo'
  | 'muted_logo'
  | 'grayscale_logo'
  | 'text_only'
  | 'hidden'

// ── Policy Rule ─────────────────────────────────────────────────────────────

/** A single policy entry governing what a role can do in a placement. */
export interface BrandPolicyRule {
  readonly role: BrandRole
  readonly placement: BrandPlacement
  /** Modes allowed for this role+placement. Empty = forbidden. */
  readonly allowedModes: readonly BrandVisibilityMode[]
  /** The safest (most restrictive) mode to use by default. */
  readonly defaultMode: BrandVisibilityMode
}

// ── Brand Asset Metadata ────────────────────────────────────────────────────

export interface BrandAsset {
  readonly id: string
  readonly role: BrandRole
  readonly name: string
  readonly shortName?: string
  /** Logo URL — if provided, usage is subject to policy rules. */
  readonly logoUrl?: string
  /** Wordmark URL — text-based logo image. */
  readonly wordmarkUrl?: string
  /** Tagline for attribution contexts (footer, about). */
  readonly tagline?: string
  /** Relationship descriptor for partnership attribution. */
  readonly relationshipLabel?: string
}

// ── Brand Registry Entry ────────────────────────────────────────────────────

export interface BrandRegistryEntry {
  readonly asset: BrandAsset
  /** Per-placement overrides (key = placement). */
  readonly placementOverrides?: Partial<Record<BrandPlacement, BrandVisibilityMode>>
}

// ── Rendering Directive ─────────────────────────────────────────────────────

/** The resolved output of brand policy evaluation. */
export interface BrandRenderDirective {
  readonly role: BrandRole
  readonly placement: BrandPlacement
  readonly mode: BrandVisibilityMode
  readonly allowed: boolean
  /** Reason if denied. */
  readonly reason?: string
}

// ── Feature Flags ───────────────────────────────────────────────────────────

export interface BrandingFeatureFlags {
  ENABLE_CLIENT_LOGO_LOGIN: boolean
  ENABLE_CLIENT_LOGO_TRUST: boolean
  ENABLE_PARTNER_BRANDING: boolean
  ENABLE_PARTNERSHIP_SECTION: boolean
}

export const DEFAULT_BRANDING_FLAGS: BrandingFeatureFlags = {
  ENABLE_CLIENT_LOGO_LOGIN: false,
  ENABLE_CLIENT_LOGO_TRUST: false,
  ENABLE_PARTNER_BRANDING: false,
  ENABLE_PARTNERSHIP_SECTION: false,
}
