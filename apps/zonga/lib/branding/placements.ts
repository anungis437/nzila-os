/**
 * Zonga — Brand Placement Policy Matrix
 *
 * The single source of truth for what brand roles are allowed
 * in each placement surface and in what visibility mode.
 *
 * Golden rule: DENY unless explicitly allowed.
 *
 * @module @zonga/branding/placements
 */

import type { BrandRole, BrandPlacement, BrandPolicyRule } from './types'

// ── Policy Matrix ───────────────────────────────────────────────────────────

/**
 * Complete policy matrix.  Every (role, placement) pair must have an entry.
 * If a pair is missing, the system denies by default.
 */
export const BRAND_POLICY_MATRIX: readonly BrandPolicyRule[] = [

  // ── Platform (Zonga) — allowed everywhere, full visibility ────────────

  { role: 'platform', placement: 'app_header',             allowedModes: ['logo', 'muted_logo', 'text_only'], defaultMode: 'logo' },
  { role: 'platform', placement: 'app_sidebar',            allowedModes: ['logo', 'muted_logo', 'text_only'], defaultMode: 'logo' },
  { role: 'platform', placement: 'app_dashboard',          allowedModes: ['logo', 'muted_logo', 'text_only'], defaultMode: 'logo' },
  { role: 'platform', placement: 'login',                  allowedModes: ['logo', 'muted_logo', 'text_only'], defaultMode: 'logo' },
  { role: 'platform', placement: 'onboarding',             allowedModes: ['logo', 'muted_logo', 'text_only'], defaultMode: 'logo' },
  { role: 'platform', placement: 'workspace_label',        allowedModes: ['logo', 'text_only'],               defaultMode: 'text_only' },
  { role: 'platform', placement: 'footer',                 allowedModes: ['logo', 'muted_logo', 'text_only'], defaultMode: 'logo' },
  { role: 'platform', placement: 'about',                  allowedModes: ['logo', 'muted_logo', 'text_only'], defaultMode: 'logo' },
  { role: 'platform', placement: 'support',                allowedModes: ['logo', 'text_only'],               defaultMode: 'text_only' },
  { role: 'platform', placement: 'marketing_hero',         allowedModes: ['logo', 'muted_logo', 'text_only'], defaultMode: 'logo' },
  { role: 'platform', placement: 'marketing_trust',        allowedModes: ['logo', 'muted_logo', 'text_only'], defaultMode: 'logo' },
  { role: 'platform', placement: 'marketing_partnership',  allowedModes: ['logo', 'text_only'],               defaultMode: 'text_only' },
  { role: 'platform', placement: 'marketing_case_study',   allowedModes: ['logo', 'muted_logo', 'text_only'], defaultMode: 'logo' },

  // ── Client — deployment context, restricted visibility ────────────────

  { role: 'client', placement: 'app_header',             allowedModes: ['text_only'],                          defaultMode: 'text_only' },
  { role: 'client', placement: 'app_sidebar',            allowedModes: ['hidden'],                             defaultMode: 'hidden' },
  { role: 'client', placement: 'app_dashboard',          allowedModes: ['hidden'],                             defaultMode: 'hidden' },
  { role: 'client', placement: 'login',                  allowedModes: ['text_only', 'muted_logo'],            defaultMode: 'text_only' },
  { role: 'client', placement: 'onboarding',             allowedModes: ['text_only'],                          defaultMode: 'text_only' },
  { role: 'client', placement: 'workspace_label',        allowedModes: ['text_only'],                          defaultMode: 'text_only' },
  { role: 'client', placement: 'footer',                 allowedModes: ['text_only'],                          defaultMode: 'text_only' },
  { role: 'client', placement: 'about',                  allowedModes: ['text_only', 'muted_logo'],            defaultMode: 'text_only' },
  { role: 'client', placement: 'support',                allowedModes: ['text_only'],                          defaultMode: 'text_only' },
  { role: 'client', placement: 'marketing_hero',         allowedModes: ['hidden'],                             defaultMode: 'hidden' },
  { role: 'client', placement: 'marketing_trust',        allowedModes: ['muted_logo', 'grayscale_logo'],       defaultMode: 'muted_logo' },
  { role: 'client', placement: 'marketing_partnership',  allowedModes: ['hidden'],                             defaultMode: 'hidden' },
  { role: 'client', placement: 'marketing_case_study',   allowedModes: ['logo', 'muted_logo'],                defaultMode: 'logo' },

  // ── Partner — strategic layer, marketing-only visibility ──────────────

  { role: 'partner', placement: 'app_header',             allowedModes: ['hidden'],                            defaultMode: 'hidden' },
  { role: 'partner', placement: 'app_sidebar',            allowedModes: ['hidden'],                            defaultMode: 'hidden' },
  { role: 'partner', placement: 'app_dashboard',          allowedModes: ['hidden'],                            defaultMode: 'hidden' },
  { role: 'partner', placement: 'login',                  allowedModes: ['hidden'],                            defaultMode: 'hidden' },
  { role: 'partner', placement: 'onboarding',             allowedModes: ['hidden'],                            defaultMode: 'hidden' },
  { role: 'partner', placement: 'workspace_label',        allowedModes: ['hidden'],                            defaultMode: 'hidden' },
  { role: 'partner', placement: 'footer',                 allowedModes: ['text_only'],                         defaultMode: 'text_only' },
  { role: 'partner', placement: 'about',                  allowedModes: ['text_only', 'muted_logo'],           defaultMode: 'text_only' },
  { role: 'partner', placement: 'support',                allowedModes: ['text_only'],                         defaultMode: 'text_only' },
  { role: 'partner', placement: 'marketing_hero',         allowedModes: ['hidden'],                            defaultMode: 'hidden' },
  { role: 'partner', placement: 'marketing_trust',        allowedModes: ['hidden'],                            defaultMode: 'hidden' },
  { role: 'partner', placement: 'marketing_partnership',  allowedModes: ['logo', 'muted_logo', 'text_only'],   defaultMode: 'logo' },
  { role: 'partner', placement: 'marketing_case_study',   allowedModes: ['logo', 'muted_logo'],                defaultMode: 'logo' },
]

// ── Lookup ──────────────────────────────────────────────────────────────────

const policyIndex = new Map<string, BrandPolicyRule>()
for (const rule of BRAND_POLICY_MATRIX) {
  policyIndex.set(`${rule.role}:${rule.placement}`, rule)
}

/**
 * Look up the policy rule for a role+placement pair.
 * Returns `undefined` if no rule exists (which means DENY).
 */
export function getPolicyRule(
  role: BrandRole,
  placement: BrandPlacement,
): BrandPolicyRule | undefined {
  return policyIndex.get(`${role}:${placement}`)
}

/**
 * Get all placements where a given role has any visibility.
 */
export function getVisiblePlacements(role: BrandRole): BrandPlacement[] {
  return BRAND_POLICY_MATRIX
    .filter((r) => r.role === role && r.allowedModes.some((m) => m !== 'hidden'))
    .map((r) => r.placement)
}

/**
 * Get all placements where a given role is explicitly forbidden.
 */
export function getForbiddenPlacements(role: BrandRole): BrandPlacement[] {
  return BRAND_POLICY_MATRIX
    .filter((r) => r.role === role && r.allowedModes.length === 1 && r.allowedModes[0] === 'hidden')
    .map((r) => r.placement)
}
