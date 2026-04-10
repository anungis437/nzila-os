/**
 * Branding Integration Tests — Surface Wiring Verification
 *
 * Validates that governed branding components integrate correctly
 * with the policy engine, registry, and feature flag system.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { BrandAsset, BrandingFeatureFlags } from '@/lib/branding/types'
import { DEFAULT_BRANDING_FLAGS } from '@/lib/branding/types'
import {
  canRenderBrand,
  getSafeBrandMode,
  getWorkspaceDisplayName,
} from '@/lib/branding/policy'
import {
  ZONGA_BRAND,
  registerBrand,
  getBrandsByRole,
  clearExternalBrands,
} from '@/lib/branding/registry'
import {
  buildAttribution,
  formatAttributionText,
  countVisibleExternalBrands,
} from '@/lib/branding/partnership'
import { loadBrandingFlags } from '@/lib/branding/feature-flags'

// ── Fixtures ────────────────────────────────────────────────────────────────

const CLIENT: BrandAsset = {
  id: 'ms-celebration',
  role: 'client',
  name: 'MS Célébration Canada',
  shortName: 'MSC',
  logoUrl: '/partners/ms-celebration.svg',
  tagline: 'La musique qui rassemble',
}

const PARTNER: BrandAsset = {
  id: 'rock-power',
  role: 'partner',
  name: 'The Rock Power Group Inc.',
  shortName: 'RPG',
  logoUrl: '/partners/rock-power.svg',
  relationshipLabel: 'National Distribution Partner',
}

const ALL_ON: BrandingFeatureFlags = {
  ENABLE_CLIENT_LOGO_LOGIN: true,
  ENABLE_CLIENT_LOGO_TRUST: true,
  ENABLE_PARTNER_BRANDING: true,
  ENABLE_PARTNERSHIP_SECTION: true,
}

// ── Integration Tests ───────────────────────────────────────────────────────

describe('Surface integration — Dashboard shell', () => {
  it('WorkspaceIdentity placement=app_sidebar allows platform logo', () => {
    const mode = getSafeBrandMode('platform', 'app_sidebar', ALL_ON)
    expect(mode).toBe('logo')
  })

  it('client is hidden in sidebar (product surface)', () => {
    expect(canRenderBrand('client', 'app_sidebar', 'text_only', ALL_ON)).toBe(false)
  })

  it('partner is hidden in sidebar', () => {
    expect(canRenderBrand('partner', 'app_sidebar', 'text_only', ALL_ON)).toBe(false)
  })

  it('workspace display name formats correctly', () => {
    expect(getWorkspaceDisplayName('MS Célébration Canada')).toBe('MS Célébration Canada Workspace')
    expect(getWorkspaceDisplayName('')).toBe('Workspace')
  })
})

describe('Surface integration — Auth pages', () => {
  it('ZONGA_BRAND provides required auth layout data', () => {
    expect(ZONGA_BRAND.name).toBe('Zonga')
    expect(ZONGA_BRAND.shortName).toBe('Z')
    expect(ZONGA_BRAND.tagline).toBeDefined()
  })

  it('platform logo is always visible in login placement', () => {
    const mode = getSafeBrandMode('platform', 'login', DEFAULT_BRANDING_FLAGS)
    expect(mode).toBe('logo')
  })

  it('client text_only appears in login when flag is on', () => {
    expect(canRenderBrand('client', 'login', 'text_only', ALL_ON)).toBe(true)
  })

  it('client logo blocked in login even when flag is on', () => {
    expect(canRenderBrand('client', 'login', 'logo', ALL_ON)).toBe(false)
  })
})

describe('Surface integration — Footer', () => {
  it('platform logo in footer is always allowed', () => {
    expect(getSafeBrandMode('platform', 'footer', DEFAULT_BRANDING_FLAGS)).toBe('logo')
  })

  it('client text_only in footer is allowed', () => {
    expect(canRenderBrand('client', 'footer', 'text_only', ALL_ON)).toBe(true)
  })

  it('partner text_only in footer is allowed when flags on', () => {
    expect(canRenderBrand('partner', 'footer', 'text_only', ALL_ON)).toBe(true)
  })

  it('partner text_only in footer is allowed even with flags off (not flag-gated)', () => {
    // Partner footer/about/support text_only is policy-allowed, not flag-gated
    expect(canRenderBrand('partner', 'footer', 'text_only', DEFAULT_BRANDING_FLAGS)).toBe(true)
  })

  it('attribution builds correctly for footer with all tiers', () => {
    const attr = buildAttribution('footer', ZONGA_BRAND, CLIENT, PARTNER, ALL_ON)
    expect(attr.platform.name).toBe('Zonga')
    expect(attr.client).toBeDefined()
    expect(attr.client!.name).toBe('MS Célébration Canada')
    expect(attr.partner).toBeDefined()
    expect(attr.partner!.name).toBe('The Rock Power Group Inc.')
  })

  it('attribution inline text includes separators', () => {
    const attr = buildAttribution('footer', ZONGA_BRAND, CLIENT, undefined, ALL_ON)
    const text = formatAttributionText(attr)
    expect(text).toContain('Powered by Zonga')
    expect(text).toContain('·')
  })
})

describe('Surface integration — Site navigation', () => {
  it('platform logo in app_header is always allowed', () => {
    expect(getSafeBrandMode('platform', 'app_header', DEFAULT_BRANDING_FLAGS)).toBe('logo')
  })

  it('ZongaBrandMark theme prop does not affect policy evaluation', () => {
    // theme is purely visual — policy is placement-based
    const modeDefault = getSafeBrandMode('platform', 'app_header')
    expect(modeDefault).toBe('logo')
  })
})

describe('Surface integration — Marketing page', () => {
  it('hero is Zonga-only (no client/partner)', () => {
    expect(canRenderBrand('client', 'marketing_hero', 'logo', ALL_ON)).toBe(false)
    expect(canRenderBrand('partner', 'marketing_hero', 'logo', ALL_ON)).toBe(false)
    expect(canRenderBrand('platform', 'marketing_hero', 'logo', ALL_ON)).toBe(true)
  })

  it('partnership section shows partner when flags on', () => {
    expect(canRenderBrand('partner', 'marketing_partnership', 'logo', ALL_ON)).toBe(true)
  })

  it('partnership section hides partner when flags off', () => {
    expect(canRenderBrand('partner', 'marketing_partnership', 'logo', DEFAULT_BRANDING_FLAGS)).toBe(false)
  })

  it('trust strip allows muted client logos when flag on', () => {
    expect(canRenderBrand('client', 'marketing_trust', 'muted_logo', ALL_ON)).toBe(true)
  })

  it('trust strip blocks client logos when flag off', () => {
    expect(canRenderBrand('client', 'marketing_trust', 'muted_logo', DEFAULT_BRANDING_FLAGS)).toBe(false)
  })
})

describe('Surface integration — Feature flag defaults', () => {
  it('all flags default to false', () => {
    const flags = loadBrandingFlags()
    expect(flags.ENABLE_CLIENT_LOGO_LOGIN).toBe(false)
    expect(flags.ENABLE_CLIENT_LOGO_TRUST).toBe(false)
    expect(flags.ENABLE_PARTNER_BRANDING).toBe(false)
    expect(flags.ENABLE_PARTNERSHIP_SECTION).toBe(false)
  })

  it('with defaults off, client and partner text_only are still visible in info surfaces', () => {
    const placements = ['footer', 'about', 'support'] as const
    for (const p of placements) {
      expect(canRenderBrand('client', p, 'text_only', DEFAULT_BRANDING_FLAGS)).toBe(true)
      // Partner text_only in footer/about/support is NOT flag-gated
      expect(canRenderBrand('partner', p, 'text_only', DEFAULT_BRANDING_FLAGS)).toBe(true)
    }
  })
})

describe('Surface integration — Registry + Attribution E2E', () => {
  beforeEach(() => {
    clearExternalBrands()
  })

  it('full attribution flow with registered brands', () => {
    registerBrand({ asset: CLIENT })
    registerBrand({ asset: PARTNER })

    expect(getBrandsByRole('client')).toHaveLength(1)
    expect(getBrandsByRole('partner')).toHaveLength(1)

    const attr = buildAttribution('footer', ZONGA_BRAND, CLIENT, PARTNER, ALL_ON)
    const text = formatAttributionText(attr)

    expect(text).toContain('Powered by Zonga')
    expect(text).toContain('MS Célébration Canada')
    expect(text).toContain('The Rock Power Group Inc.')
  })

  it('visible external brand count reflects policy', () => {
    expect(countVisibleExternalBrands('footer', true, true, ALL_ON)).toBe(2)
    expect(countVisibleExternalBrands('footer', true, true, DEFAULT_BRANDING_FLAGS)).toBe(2) // both client + partner text_only
    expect(countVisibleExternalBrands('app_header', true, true, ALL_ON)).toBe(1) // only client text
    expect(countVisibleExternalBrands('app_dashboard', true, true, ALL_ON)).toBe(0) // none
  })
})
