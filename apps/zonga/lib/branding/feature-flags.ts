/**
 * Zonga — Branding Feature Flags
 *
 * Conservative-by-default feature flags for controlling
 * brand visibility. All flags default to OFF.
 *
 * @module @zonga/branding/feature-flags
 */

import type { BrandingFeatureFlags } from './types'
import { DEFAULT_BRANDING_FLAGS } from './types'

/**
 * Load branding feature flags from environment variables.
 * Falls back to conservative defaults (all off).
 */
export function loadBrandingFlags(): BrandingFeatureFlags {
  if (typeof process === 'undefined') return DEFAULT_BRANDING_FLAGS

  return {
    ENABLE_CLIENT_LOGO_LOGIN:
      process.env.NEXT_PUBLIC_ENABLE_CLIENT_LOGO_LOGIN === 'true',
    ENABLE_CLIENT_LOGO_TRUST:
      process.env.NEXT_PUBLIC_ENABLE_CLIENT_LOGO_TRUST === 'true',
    ENABLE_PARTNER_BRANDING:
      process.env.NEXT_PUBLIC_ENABLE_PARTNER_BRANDING === 'true',
    ENABLE_PARTNERSHIP_SECTION:
      process.env.NEXT_PUBLIC_ENABLE_PARTNERSHIP_SECTION === 'true',
  }
}
