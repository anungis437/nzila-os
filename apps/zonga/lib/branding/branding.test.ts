/**
 * Branding Policy & Enforcement Tests
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { BrandAsset, BrandingFeatureFlags, BrandPlacement, BrandRole } from '@/lib/branding/types'
import { DEFAULT_BRANDING_FLAGS } from '@/lib/branding/types'
import { BRAND_POLICY_MATRIX, getPolicyRule, getVisiblePlacements, getForbiddenPlacements } from '@/lib/branding/placements'
import {
  evaluateBrandPolicy,
  canRenderBrand,
  assertBrandPolicy,
  getSafeBrandMode,
  getWorkspaceDisplayName,
  detectWhiteLabelViolations,
  BrandPolicyViolation,
} from '@/lib/branding/policy'
import {
  buildAttribution,
  formatAttributionText,
  getPartnerRelationshipLabel,
  countVisibleExternalBrands,
} from '@/lib/branding/partnership'
import {
  ZONGA_BRAND,
  registerBrand,
  getBrand,
  getPlatformBrand,
  getBrandsByRole,
  isBrandRegistered,
  unregisterBrand,
  clearExternalBrands,
} from '@/lib/branding/registry'

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

// ── Policy Matrix ───────────────────────────────────────────────────────────

describe('BRAND_POLICY_MATRIX', () => {
  it('contains exactly 39 rules (13 placements × 3 roles)', () => {
    expect(BRAND_POLICY_MATRIX).toHaveLength(39)
  })

  it('has 13 rules per role', () => {
    const roles: BrandRole[] = ['platform', 'client', 'partner']
    for (const role of roles) {
      const count = BRAND_POLICY_MATRIX.filter((r) => r.role === role).length
      expect(count, `Expected 13 rules for ${role}`).toBe(13)
    }
  })

  it('has no duplicate role+placement pairs', () => {
    const keys = BRAND_POLICY_MATRIX.map((r) => `${r.role}:${r.placement}`)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('getPolicyRule', () => {
  it('returns the rule for platform+app_header', () => {
    const rule = getPolicyRule('platform', 'app_header')
    expect(rule).toBeDefined()
    expect(rule!.role).toBe('platform')
    expect(rule!.allowedModes).toContain('logo')
  })

  it('returns undefined for non-existent combinations (DENY)', () => {
    const rule = getPolicyRule('partner' as BrandRole, 'nonexistent' as BrandPlacement)
    expect(rule).toBeUndefined()
  })
})

describe('getVisiblePlacements / getForbiddenPlacements', () => {
  it('platform is visible everywhere', () => {
    const visible = getVisiblePlacements('platform')
    expect(visible.length).toBe(13)
  })

  it('partner has forbidden placements', () => {
    const forbidden = getForbiddenPlacements('partner')
    expect(forbidden.length).toBeGreaterThan(0)
    expect(forbidden).toContain('app_header')
    expect(forbidden).toContain('app_dashboard')
  })

  it('client is hidden in dashboard and hero', () => {
    const forbidden = getForbiddenPlacements('client')
    expect(forbidden).toContain('app_dashboard')
    expect(forbidden).toContain('marketing_hero')
  })
})

// ── Policy Enforcement ──────────────────────────────────────────────────────

describe('evaluateBrandPolicy', () => {
  it('allows platform logo in header', () => {
    const d = evaluateBrandPolicy('platform', 'app_header', 'logo', ALL_ON)
    expect(d.allowed).toBe(true)
    expect(d.mode).toBe('logo')
  })

  it('denies client logo in header (text_only max)', () => {
    const d = evaluateBrandPolicy('client', 'app_header', 'logo', ALL_ON)
    expect(d.allowed).toBe(false)
  })

  it('allows client text_only in header', () => {
    const d = evaluateBrandPolicy('client', 'app_header', 'text_only', ALL_ON)
    expect(d.allowed).toBe(true)
  })

  it('denies partner in app_header completely', () => {
    const d = evaluateBrandPolicy('partner', 'app_header', 'text_only', ALL_ON)
    expect(d.allowed).toBe(false)
  })

  it('DENY by default for unknown role+placement', () => {
    const d = evaluateBrandPolicy('partner' as BrandRole, 'unknown' as BrandPlacement, 'logo', ALL_ON)
    expect(d.allowed).toBe(false)
    expect(d.reason).toContain('denied by default')
  })
})

describe('canRenderBrand', () => {
  it('returns true for allowed combinations', () => {
    expect(canRenderBrand('platform', 'app_header', 'logo', ALL_ON)).toBe(true)
  })

  it('returns false for denied combinations', () => {
    expect(canRenderBrand('partner', 'app_header', 'logo', ALL_ON)).toBe(false)
  })
})

describe('assertBrandPolicy', () => {
  it('does not throw for allowed combinations', () => {
    expect(() => assertBrandPolicy('platform', 'app_header', 'logo', ALL_ON)).not.toThrow()
  })

  it('throws BrandPolicyViolation for denied combinations', () => {
    expect(() => assertBrandPolicy('partner', 'app_header', 'logo', ALL_ON)).toThrow(BrandPolicyViolation)
  })

  it('violation has directive with reason', () => {
    try {
      assertBrandPolicy('partner', 'app_header', 'logo', ALL_ON)
      expect.unreachable('Should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(BrandPolicyViolation)
      expect((e as BrandPolicyViolation).directive.reason).toBeDefined()
    }
  })
})

describe('getSafeBrandMode', () => {
  it('returns logo for platform header', () => {
    expect(getSafeBrandMode('platform', 'app_header', ALL_ON)).toBe('logo')
  })

  it('returns text_only for client header', () => {
    expect(getSafeBrandMode('client', 'app_header', ALL_ON)).toBe('text_only')
  })

  it('returns hidden for partner header', () => {
    expect(getSafeBrandMode('partner', 'app_header', ALL_ON)).toBe('hidden')
  })

  it('returns hidden for unknown placement', () => {
    expect(getSafeBrandMode('platform', 'unknown' as BrandPlacement, ALL_ON)).toBe('hidden')
  })
})

describe('getWorkspaceDisplayName', () => {
  it('appends "Workspace" to client name', () => {
    expect(getWorkspaceDisplayName('MS Célébration Canada')).toBe('MS Célébration Canada Workspace')
  })

  it('returns "Workspace" for empty string', () => {
    expect(getWorkspaceDisplayName('')).toBe('Workspace')
    expect(getWorkspaceDisplayName('   ')).toBe('Workspace')
  })
})

// ── Feature Flag Gating ─────────────────────────────────────────────────────

describe('Feature flag gating', () => {
  it('blocks client trust-strip logo when flag is off', () => {
    const flags: BrandingFeatureFlags = { ...ALL_ON, ENABLE_CLIENT_LOGO_TRUST: false }
    const d = evaluateBrandPolicy('client', 'marketing_trust', 'muted_logo', flags)
    expect(d.allowed).toBe(false)
    expect(d.reason).toContain('ENABLE_CLIENT_LOGO_TRUST')
  })

  it('blocks partnership section when flag is off', () => {
    const flags: BrandingFeatureFlags = { ...ALL_ON, ENABLE_PARTNERSHIP_SECTION: false }
    const d = evaluateBrandPolicy('partner', 'marketing_partnership', 'logo', flags)
    expect(d.allowed).toBe(false)
    expect(d.reason).toContain('ENABLE_PARTNERSHIP_SECTION')
  })

  it('blocks partner marketing placements when partner branding disabled', () => {
    const flags: BrandingFeatureFlags = { ...ALL_ON, ENABLE_PARTNER_BRANDING: false }
    const d = evaluateBrandPolicy('partner', 'marketing_case_study', 'logo', flags)
    expect(d.allowed).toBe(false)
    expect(d.reason).toContain('ENABLE_PARTNER_BRANDING')
  })

  it('all defaults are off', () => {
    expect(DEFAULT_BRANDING_FLAGS.ENABLE_CLIENT_LOGO_LOGIN).toBe(false)
    expect(DEFAULT_BRANDING_FLAGS.ENABLE_CLIENT_LOGO_TRUST).toBe(false)
    expect(DEFAULT_BRANDING_FLAGS.ENABLE_PARTNER_BRANDING).toBe(false)
    expect(DEFAULT_BRANDING_FLAGS.ENABLE_PARTNERSHIP_SECTION).toBe(false)
  })
})

// ── Anti-White-Label Safeguards ─────────────────────────────────────────────

describe('detectWhiteLabelViolations', () => {
  it('passes clean config', () => {
    const violations = detectWhiteLabelViolations([
      { role: 'platform', placement: 'app_header', mode: 'logo' },
      { role: 'client', placement: 'app_header', mode: 'text_only' },
    ])
    expect(violations).toHaveLength(0)
  })

  it('detects client logo in header', () => {
    const violations = detectWhiteLabelViolations([
      { role: 'client', placement: 'app_header', mode: 'logo' },
    ])
    expect(violations.length).toBeGreaterThan(0)
    expect(violations[0]).toContain('Client logo in app_header')
  })

  it('detects partner in header', () => {
    const violations = detectWhiteLabelViolations([
      { role: 'partner', placement: 'app_header', mode: 'text_only' },
    ])
    expect(violations.length).toBeGreaterThan(0)
  })

  it('detects dual-logo headers', () => {
    const violations = detectWhiteLabelViolations([
      { role: 'platform', placement: 'app_header', mode: 'logo' },
      { role: 'client', placement: 'app_header', mode: 'logo' },
    ])
    expect(violations.some((v) => v.includes('Dual-logo'))).toBe(true)
  })

  it('detects co-branded hero', () => {
    const violations = detectWhiteLabelViolations([
      { role: 'platform', placement: 'marketing_hero', mode: 'logo' },
      { role: 'client', placement: 'marketing_hero', mode: 'muted_logo' },
    ])
    expect(violations.some((v) => v.includes('hero'))).toBe(true)
  })

  it('detects partner in product surfaces', () => {
    const violations = detectWhiteLabelViolations([
      { role: 'partner', placement: 'app_dashboard', mode: 'text_only' },
    ])
    expect(violations.some((v) => v.includes('product surfaces'))).toBe(true)
  })
})

// ── Partnership Attribution ─────────────────────────────────────────────────

describe('buildAttribution', () => {
  it('builds platform-only attribution', () => {
    const attr = buildAttribution('footer', ZONGA_BRAND, undefined, undefined, ALL_ON)
    expect(attr.platform.name).toBe('Zonga')
    expect(attr.platform.label).toBe('Powered by')
    expect(attr.client).toBeUndefined()
    expect(attr.partner).toBeUndefined()
  })

  it('builds platform+client attribution for footer', () => {
    const attr = buildAttribution('footer', ZONGA_BRAND, CLIENT, undefined, ALL_ON)
    expect(attr.platform.name).toBe('Zonga')
    expect(attr.client).toBeDefined()
    expect(attr.client!.name).toBe('MS Célébration Canada')
    expect(attr.client!.label).toBe('Deployed for')
  })

  it('hides client when policy denies placement', () => {
    const attr = buildAttribution('app_dashboard', ZONGA_BRAND, CLIENT, undefined, ALL_ON)
    // Client is hidden in dashboard per policy
    expect(attr.client).toBeUndefined()
  })

  it('hides partner in app surfaces', () => {
    const attr = buildAttribution('app_header', ZONGA_BRAND, CLIENT, PARTNER, ALL_ON)
    expect(attr.partner).toBeUndefined()
  })
})

describe('formatAttributionText', () => {
  it('formats single-line with separator', () => {
    const attr = buildAttribution('footer', ZONGA_BRAND, CLIENT, undefined, ALL_ON)
    const text = formatAttributionText(attr)
    expect(text).toContain('Powered by Zonga')
    expect(text).toContain('Deployed for MS Célébration Canada')
    expect(text).toContain(' · ')
  })
})

describe('getPartnerRelationshipLabel', () => {
  it('returns custom label when set', () => {
    expect(getPartnerRelationshipLabel(PARTNER)).toBe('National Distribution Partner')
  })

  it('returns default when not set', () => {
    const p: BrandAsset = { ...PARTNER, relationshipLabel: undefined }
    expect(getPartnerRelationshipLabel(p)).toBe('Distribution Partner')
  })
})

describe('countVisibleExternalBrands', () => {
  it('counts visible brands in footer', () => {
    const count = countVisibleExternalBrands('footer', true, true, ALL_ON)
    // Client is visible in footer (text_only), partner is also visible (text_only)
    expect(count).toBe(2)
  })

  it('returns 0 when no externals', () => {
    expect(countVisibleExternalBrands('app_header', false, false, ALL_ON)).toBe(0)
  })
})

// ── Brand Registry ──────────────────────────────────────────────────────────

describe('Brand Registry', () => {
  beforeEach(() => {
    clearExternalBrands()
  })

  it('Zonga brand is always registered', () => {
    expect(isBrandRegistered('zonga')).toBe(true)
    expect(getPlatformBrand().name).toBe('Zonga')
  })

  it('registers and retrieves a client brand', () => {
    registerBrand({ asset: CLIENT })
    const entry = getBrand('ms-celebration')
    expect(entry).toBeDefined()
    expect(entry!.asset.name).toBe('MS Célébration Canada')
  })

  it('registers and retrieves a partner brand', () => {
    registerBrand({ asset: PARTNER })
    const entry = getBrand('rock-power')
    expect(entry).toBeDefined()
    expect(entry!.asset.role).toBe('partner')
  })

  it('getBrandsByRole returns correct brands', () => {
    registerBrand({ asset: CLIENT })
    registerBrand({ asset: PARTNER })
    expect(getBrandsByRole('client')).toHaveLength(1)
    expect(getBrandsByRole('partner')).toHaveLength(1)
    expect(getBrandsByRole('platform')).toHaveLength(1)
  })

  it('cannot re-register or remove Zonga', () => {
    registerBrand({ asset: { ...ZONGA_BRAND, name: 'HackedName' } })
    expect(getPlatformBrand().name).toBe('Zonga') // unchanged
    expect(unregisterBrand('zonga')).toBe(false)
    expect(isBrandRegistered('zonga')).toBe(true)
  })

  it('can unregister client brands', () => {
    registerBrand({ asset: CLIENT })
    expect(unregisterBrand('ms-celebration')).toBe(true)
    expect(isBrandRegistered('ms-celebration')).toBe(false)
  })

  it('clearExternalBrands removes all non-platform', () => {
    registerBrand({ asset: CLIENT })
    registerBrand({ asset: PARTNER })
    clearExternalBrands()
    expect(getBrandsByRole('client')).toHaveLength(0)
    expect(getBrandsByRole('partner')).toHaveLength(0)
    expect(isBrandRegistered('zonga')).toBe(true)
  })
})

// ── Comprehensive Policy Matrix Validation ──────────────────────────────────

describe('Policy matrix invariants', () => {
  it('platform is never hidden in any placement', () => {
    const placements: BrandPlacement[] = [
      'app_header', 'app_dashboard', 'app_sidebar', 'workspace_label',
      'login', 'onboarding', 'footer', 'about',
      'support', 'marketing_hero', 'marketing_trust',
      'marketing_partnership', 'marketing_case_study',
    ]
    for (const p of placements) {
      const mode = getSafeBrandMode('platform', p, ALL_ON)
      expect(mode, `Platform should be visible in ${p}`).not.toBe('hidden')
    }
  })

  it('partner never appears in product surfaces', () => {
    const productPlacements: BrandPlacement[] = [
      'app_header', 'app_dashboard', 'app_sidebar',
      'workspace_label', 'login',
    ]
    for (const p of productPlacements) {
      expect(canRenderBrand('partner', p, 'logo', ALL_ON), `Partner should be hidden in ${p}`).toBe(false)
      expect(canRenderBrand('partner', p, 'text_only', ALL_ON), `Partner text should be hidden in ${p}`).toBe(false)
    }
  })

  it('client never uses full logo in header', () => {
    expect(canRenderBrand('client', 'app_header', 'logo', ALL_ON)).toBe(false)
    expect(canRenderBrand('client', 'app_header', 'muted_logo', ALL_ON)).toBe(false)
  })

  it('hero is Zonga-only', () => {
    expect(canRenderBrand('platform', 'marketing_hero', 'logo', ALL_ON)).toBe(true)
    expect(canRenderBrand('client', 'marketing_hero', 'logo', ALL_ON)).toBe(false)
    expect(canRenderBrand('partner', 'marketing_hero', 'logo', ALL_ON)).toBe(false)
  })
})
