/**
 * Zonga — Brand Policy Enforcement
 *
 * Enforcement utilities that ALL rendering components must use.
 * No external brand asset may be rendered without passing through
 * these functions.
 *
 * @module @zonga/branding/policy
 */

import type {
  BrandRole,
  BrandPlacement,
  BrandVisibilityMode,
  BrandRenderDirective,
  BrandingFeatureFlags,
} from './types'
import { DEFAULT_BRANDING_FLAGS } from './types'
import { getPolicyRule } from './placements'
import { loadBrandingFlags } from './feature-flags'

// ── Core Enforcement ────────────────────────────────────────────────────────

/**
 * Evaluate whether a brand role can render in a given placement/mode.
 * Returns a full directive with allowed status and reason.
 *
 * This is the primary gate — all rendering must go through this.
 */
export function evaluateBrandPolicy(
  role: BrandRole,
  placement: BrandPlacement,
  requestedMode: BrandVisibilityMode,
  flags?: BrandingFeatureFlags,
): BrandRenderDirective {
  const rule = getPolicyRule(role, placement)

  // No rule → DENY (default-deny policy)
  if (!rule) {
    return {
      role,
      placement,
      mode: 'hidden',
      allowed: false,
      reason: `No policy rule for ${role}:${placement} — denied by default`,
    }
  }

  // Check feature-flag gates for optional placements
  const effectiveFlags = flags ?? loadBrandingFlags()
  const flagDenial = checkFeatureFlagGate(role, placement, effectiveFlags)
  if (flagDenial) {
    return {
      role,
      placement,
      mode: 'hidden',
      allowed: false,
      reason: flagDenial,
    }
  }

  // Only 'hidden' allowed → forbidden
  if (rule.allowedModes.length === 1 && rule.allowedModes[0] === 'hidden') {
    return {
      role,
      placement,
      mode: 'hidden',
      allowed: false,
      reason: `${role} is forbidden in ${placement}`,
    }
  }

  // Requested mode is in allowed list
  if (rule.allowedModes.includes(requestedMode)) {
    return { role, placement, mode: requestedMode, allowed: true }
  }

  // Requested mode not allowed — deny
  return {
    role,
    placement,
    mode: 'hidden',
    allowed: false,
    reason: `Mode '${requestedMode}' not allowed for ${role} in ${placement}. Allowed: ${rule.allowedModes.join(', ')}`,
  }
}

// ── Convenience Functions ───────────────────────────────────────────────────

/**
 * Quick boolean check: can this role render in this placement at this mode?
 */
export function canRenderBrand(
  role: BrandRole,
  placement: BrandPlacement,
  mode: BrandVisibilityMode,
  flags?: BrandingFeatureFlags,
): boolean {
  return evaluateBrandPolicy(role, placement, mode, flags).allowed
}

/**
 * Assert that a brand policy allows rendering. Throws if denied.
 * Use in server components and API routes for hard enforcement.
 */
export function assertBrandPolicy(
  role: BrandRole,
  placement: BrandPlacement,
  mode: BrandVisibilityMode,
  flags?: BrandingFeatureFlags,
): void {
  const directive = evaluateBrandPolicy(role, placement, mode, flags)
  if (!directive.allowed) {
    throw new BrandPolicyViolation(directive)
  }
}

/**
 * Get the safest (most restrictive) allowed mode for a role+placement.
 * Returns 'hidden' if completely forbidden.
 */
export function getSafeBrandMode(
  role: BrandRole,
  placement: BrandPlacement,
  flags?: BrandingFeatureFlags,
): BrandVisibilityMode {
  const rule = getPolicyRule(role, placement)
  if (!rule) return 'hidden'

  const effectiveFlags = flags ?? loadBrandingFlags()
  const flagDenial = checkFeatureFlagGate(role, placement, effectiveFlags)
  if (flagDenial) return 'hidden'

  return rule.defaultMode
}

/**
 * Format a workspace display name from the client name.
 *
 * Example: "MS Célébration Canada" → "MS Célébration Workspace"
 */
export function getWorkspaceDisplayName(clientName: string): string {
  if (!clientName.trim()) return 'Workspace'
  return `${clientName.trim()} Workspace`
}

// ── Anti-White-Label Safeguards ─────────────────────────────────────────────

/**
 * Validate that a brand configuration does not violate anti-white-label rules.
 * Returns a list of violations (empty = clean).
 */
export function detectWhiteLabelViolations(
  configs: ReadonlyArray<{ role: BrandRole; placement: BrandPlacement; mode: BrandVisibilityMode }>,
): string[] {
  const violations: string[] = []

  // Rule 1: Client logo must never appear in header alongside Zonga
  const clientHeader = configs.find(
    (c) => c.role === 'client' && c.placement === 'app_header' && c.mode !== 'text_only' && c.mode !== 'hidden',
  )
  if (clientHeader) {
    violations.push('Client logo in app_header violates anti-white-label policy — text_only maximum')
  }

  // Rule 2: Partner must never appear in header
  const partnerHeader = configs.find(
    (c) => c.role === 'partner' && c.placement === 'app_header' && c.mode !== 'hidden',
  )
  if (partnerHeader) {
    violations.push('Partner must not appear in app_header')
  }

  // Rule 3: No dual-logo headers
  const headerLogos = configs.filter(
    (c) => c.placement === 'app_header' && (c.mode === 'logo' || c.mode === 'muted_logo'),
  )
  if (headerLogos.length > 1) {
    violations.push('Dual-logo headers are forbidden — only Zonga logo allowed in header')
  }

  // Rule 4: No co-branded hero sections
  const heroEntries = configs.filter(
    (c) => c.placement === 'marketing_hero' && c.mode !== 'hidden',
  )
  const nonPlatformHero = heroEntries.filter((c) => c.role !== 'platform')
  if (nonPlatformHero.length > 0) {
    violations.push('Marketing hero must contain only Zonga branding')
  }

  // Rule 5: Partner must never appear as product owner (dashboard/login)
  const partnerProduct = configs.find(
    (c) => c.role === 'partner' && (c.placement === 'app_dashboard' || c.placement === 'login') && c.mode !== 'hidden',
  )
  if (partnerProduct) {
    violations.push('Partner must not appear in product surfaces (dashboard/login)')
  }

  return violations
}

// ── Error Type ──────────────────────────────────────────────────────────────

export class BrandPolicyViolation extends Error {
  constructor(public readonly directive: BrandRenderDirective) {
    super(`Brand policy violation: ${directive.reason ?? `${directive.role} denied in ${directive.placement}`}`)
    this.name = 'BrandPolicyViolation'
  }
}

// ── Internal ────────────────────────────────────────────────────────────────

function checkFeatureFlagGate(
  role: BrandRole,
  placement: BrandPlacement,
  flags: BrandingFeatureFlags,
): string | null {
  if (role === 'client' && placement === 'login' && !flags.ENABLE_CLIENT_LOGO_LOGIN) {
    // Allow text_only even when flag is off — only block logo modes
    // Handled at the mode level, not placement level
    return null
  }

  if (role === 'client' && placement === 'marketing_trust' && !flags.ENABLE_CLIENT_LOGO_TRUST) {
    return 'Client trust-strip logo disabled by feature flag ENABLE_CLIENT_LOGO_TRUST'
  }

  if (role === 'partner' && !flags.ENABLE_PARTNER_BRANDING) {
    // Partners are still allowed in text_only footer/about/support
    // but logo modes are blocked
    if (placement === 'marketing_partnership' || placement === 'marketing_case_study') {
      return 'Partner branding disabled by feature flag ENABLE_PARTNER_BRANDING'
    }
  }

  if (placement === 'marketing_partnership' && !flags.ENABLE_PARTNERSHIP_SECTION) {
    return 'Partnership section disabled by feature flag ENABLE_PARTNERSHIP_SECTION'
  }

  return null
}
