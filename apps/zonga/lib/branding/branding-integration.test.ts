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
  CLIENT_BRAND,
  PARTNER_BRAND,
  initializeBrands,
  getClientBrand,
  getPartnerBrand,
} from '@/lib/branding/brand-config'
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

  it('client logo is allowed in sidebar (workspace context)', () => {
    expect(canRenderBrand('client', 'app_sidebar', 'logo', ALL_ON)).toBe(true)
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

// ── Brand Config Tests ──────────────────────────────────────────────────────

describe('Brand config — deployment brands', () => {
  beforeEach(() => {
    clearExternalBrands()
  })

  it('CLIENT_BRAND has correct role and metadata', () => {
    expect(CLIENT_BRAND.role).toBe('client')
    expect(CLIENT_BRAND.id).toBe('ms-celebration')
    expect(CLIENT_BRAND.name).toBe('MS Célébration Canada')
    expect(CLIENT_BRAND.logoUrl).toBeDefined()
  })

  it('PARTNER_BRAND has correct role and metadata', () => {
    expect(PARTNER_BRAND.role).toBe('partner')
    expect(PARTNER_BRAND.id).toBe('rock-power')
    expect(PARTNER_BRAND.name).toBe('The Rock Power Group Inc.')
    expect(PARTNER_BRAND.relationshipLabel).toBeDefined()
  })

  it('initializeBrands registers both brands in registry', () => {
    initializeBrands()
    expect(getBrandsByRole('client')).toHaveLength(1)
    expect(getBrandsByRole('partner')).toHaveLength(1)
    expect(getBrandsByRole('client')[0].asset.id).toBe('ms-celebration')
    expect(getBrandsByRole('partner')[0].asset.id).toBe('rock-power')
  })

  it('getClientBrand and getPartnerBrand return assets', () => {
    expect(getClientBrand()).toBe(CLIENT_BRAND)
    expect(getPartnerBrand()).toBe(PARTNER_BRAND)
  })
})

// ── About Page Integration ──────────────────────────────────────────────────

describe('Surface integration — About page', () => {
  it('platform logo is allowed in about placement', () => {
    expect(getSafeBrandMode('platform', 'about', DEFAULT_BRANDING_FLAGS)).toBe('logo')
  })

  it('client text_only is allowed in about placement', () => {
    expect(canRenderBrand('client', 'about', 'text_only', DEFAULT_BRANDING_FLAGS)).toBe(true)
  })

  it('partner text_only is allowed in about placement (not flag-gated)', () => {
    expect(canRenderBrand('partner', 'about', 'text_only', DEFAULT_BRANDING_FLAGS)).toBe(true)
  })

  it('attribution builds correctly for about with all tiers', () => {
    const attr = buildAttribution('about', ZONGA_BRAND, CLIENT_BRAND, PARTNER_BRAND, ALL_ON)
    expect(attr.platform.name).toBe('Zonga')
    expect(attr.client).toBeDefined()
    expect(attr.client!.name).toBe('MS Célébration Canada')
    expect(attr.partner).toBeDefined()
    expect(attr.partner!.name).toBe('The Rock Power Group Inc.')
  })
})

// ── Support/Contact Page Integration ────────────────────────────────────────

describe('Surface integration — Support/Contact page', () => {
  it('platform text_only is the default in support placement', () => {
    expect(getSafeBrandMode('platform', 'support', DEFAULT_BRANDING_FLAGS)).toBe('text_only')
  })

  it('client text_only is allowed in support placement', () => {
    expect(canRenderBrand('client', 'support', 'text_only', DEFAULT_BRANDING_FLAGS)).toBe(true)
  })

  it('partner text_only is allowed in support placement', () => {
    expect(canRenderBrand('partner', 'support', 'text_only', DEFAULT_BRANDING_FLAGS)).toBe(true)
  })
})

// ── Case Study Page Integration ─────────────────────────────────────────────

describe('Surface integration — Case study page', () => {
  it('platform logo is allowed in case study placement', () => {
    expect(getSafeBrandMode('platform', 'marketing_case_study', ALL_ON)).toBe('logo')
  })

  it('client gets logo mode in case study (strongest visibility)', () => {
    expect(canRenderBrand('client', 'marketing_case_study', 'logo', ALL_ON)).toBe(true)
  })

  it('partner gets logo mode in case study (strongest visibility)', () => {
    expect(canRenderBrand('partner', 'marketing_case_study', 'logo', ALL_ON)).toBe(true)
  })

  it('case study attribution includes all three tiers', () => {
    const attr = buildAttribution('marketing_case_study', ZONGA_BRAND, CLIENT_BRAND, PARTNER_BRAND, ALL_ON)
    expect(attr.platform.name).toBe('Zonga')
    expect(attr.platform.showLogo).toBe(true)
    expect(attr.client).toBeDefined()
    expect(attr.client!.showLogo).toBe(true)
    expect(attr.partner).toBeDefined()
    expect(attr.partner!.showLogo).toBe(true)
  })

  it('case study shows client brand with conservative flags', () => {
    // Client logo in case study is NOT flag-gated
    expect(canRenderBrand('client', 'marketing_case_study', 'logo', DEFAULT_BRANDING_FLAGS)).toBe(true)
  })

  it('case study partner logo requires ENABLE_PARTNER_BRANDING flag', () => {
    // Partner in marketing_case_study is gated by ENABLE_PARTNER_BRANDING
    expect(canRenderBrand('partner', 'marketing_case_study', 'logo', DEFAULT_BRANDING_FLAGS)).toBe(false)
    expect(canRenderBrand('partner', 'marketing_case_study', 'logo', ALL_ON)).toBe(true)
  })
})

// ── Homepage Trust Strip Integration ────────────────────────────────────────

describe('Surface integration — Homepage trust strip', () => {
  it('client muted_logo is allowed in marketing_trust with flag on', () => {
    expect(canRenderBrand('client', 'marketing_trust', 'muted_logo', ALL_ON)).toBe(true)
  })

  it('client muted_logo is blocked when ENABLE_CLIENT_LOGO_TRUST is off', () => {
    expect(canRenderBrand('client', 'marketing_trust', 'muted_logo', DEFAULT_BRANDING_FLAGS)).toBe(false)
  })

  it('partner is hidden in marketing_trust (trust strip is client-only)', () => {
    expect(canRenderBrand('partner', 'marketing_trust', 'muted_logo', ALL_ON)).toBe(false)
    expect(canRenderBrand('partner', 'marketing_trust', 'text_only', ALL_ON)).toBe(false)
  })

  it('trust strip with governed brands only renders policy-allowed brands', () => {
    // Even if both client and partner are passed, partner is hidden by policy
    const clientVisible = canRenderBrand('client', 'marketing_trust', 'logo', ALL_ON)
    const partnerVisible = canRenderBrand('partner', 'marketing_trust', 'logo', ALL_ON)
    expect(clientVisible).toBe(false) // logo mode not in allowedModes for client trust
    expect(partnerVisible).toBe(false) // partner hidden in trust
  })

  it('trust strip client renders as muted_logo or grayscale_logo', () => {
    expect(getSafeBrandMode('client', 'marketing_trust', ALL_ON)).toBe('muted_logo')
  })
})

// ── Footer Attribution Integration ──────────────────────────────────────────

describe('Surface integration — Footer attribution', () => {
  it('footer attribution includes all three tiers when brands provided', () => {
    const attr = buildAttribution('footer', ZONGA_BRAND, CLIENT, PARTNER, ALL_ON)
    expect(attr.platform.name).toBe('Zonga')
    expect(attr.client).toBeDefined()
    expect(attr.client!.name).toBe('MS Célébration Canada')
    expect(attr.partner).toBeDefined()
    expect(attr.partner!.name).toBe('The Rock Power Group Inc.')
  })

  it('footer renders client and partner as text_only (no logos)', () => {
    expect(canRenderBrand('client', 'footer', 'text_only', DEFAULT_BRANDING_FLAGS)).toBe(true)
    expect(canRenderBrand('partner', 'footer', 'text_only', DEFAULT_BRANDING_FLAGS)).toBe(true)
    expect(canRenderBrand('client', 'footer', 'logo', DEFAULT_BRANDING_FLAGS)).toBe(false)
    expect(canRenderBrand('partner', 'footer', 'logo', DEFAULT_BRANDING_FLAGS)).toBe(false)
  })
})

// ── Hero Zonga-Only Enforcement ─────────────────────────────────────────────

describe('Surface integration — Hero remains Zonga-only', () => {
  it('platform logo is allowed in hero', () => {
    expect(canRenderBrand('platform', 'marketing_hero', 'logo', ALL_ON)).toBe(true)
  })

  it('client is strictly forbidden in hero', () => {
    expect(canRenderBrand('client', 'marketing_hero', 'logo', ALL_ON)).toBe(false)
    expect(canRenderBrand('client', 'marketing_hero', 'text_only', ALL_ON)).toBe(false)
    expect(canRenderBrand('client', 'marketing_hero', 'muted_logo', ALL_ON)).toBe(false)
  })

  it('partner is strictly forbidden in hero', () => {
    expect(canRenderBrand('partner', 'marketing_hero', 'logo', ALL_ON)).toBe(false)
    expect(canRenderBrand('partner', 'marketing_hero', 'text_only', ALL_ON)).toBe(false)
    expect(canRenderBrand('partner', 'marketing_hero', 'muted_logo', ALL_ON)).toBe(false)
  })
})

// ── Partner Never in App Shell ──────────────────────────────────────────────

describe('Surface integration — Partner never in app shell', () => {
  const appShellPlacements = ['app_header', 'app_sidebar', 'app_dashboard', 'login', 'onboarding'] as const

  for (const placement of appShellPlacements) {
    it(`partner is hidden in ${placement} (even with all flags on)`, () => {
      expect(canRenderBrand('partner', placement, 'logo', ALL_ON)).toBe(false)
      expect(canRenderBrand('partner', placement, 'text_only', ALL_ON)).toBe(false)
    })
  }
})
