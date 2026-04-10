/**
 * Brand Governance Contract Test
 *
 * Enforces that all Zonga app surfaces use the governed branding system
 * (components/branding/*) rather than hardcoding brand marks inline.
 *
 * Violations detected:
 *   1. Hardcoded "Z" icon spans outside branding components
 *   2. Direct import of brand assets bypassing the registry
 *   3. Un-governed brand placements (logo rendering without policy check)
 */
import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

const ZONGA_ROOT = path.resolve(__dirname, '../../apps/zonga')

// ── Helpers ──────────────────────────────────────────────────────────────────

function findFiles(dir: string, ext: string[]): string[] {
  const results: string[] = []
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return results
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      results.push(...findFiles(full, ext))
    } else if (entry.isFile() && ext.some((e) => entry.name.endsWith(e))) {
      results.push(full)
    }
  }
  return results
}

function relPath(filePath: string): string {
  return path.relative(ZONGA_ROOT, filePath).replace(/\\/g, '/')
}

// ── Files that ARE the branding system (allowed to use raw brand marks) ─────

const BRANDING_ALLOWLIST = new Set([
  'components/branding/ZongaBrandMark.tsx',
  'components/branding/ExternalBrandMark.tsx',
  'components/branding/WorkspaceIdentity.tsx',
  'components/branding/PartnershipAttribution.tsx',
  'components/branding/TrustStrip.tsx',
  'components/branding/index.ts',
  'lib/branding/types.ts',
  'lib/branding/policy.ts',
  'lib/branding/placements.ts',
  'lib/branding/registry.ts',
  'lib/branding/partnership.ts',
  'lib/branding/feature-flags.ts',
  'lib/branding/brand-config.ts',
  'lib/branding/index.ts',
  'lib/branding/branding.test.ts',
  'lib/branding/branding-integration.test.ts',
])

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Brand Governance', () => {
  const componentFiles = findFiles(path.join(ZONGA_ROOT, 'components'), ['.tsx', '.ts'])
    .filter((f) => !BRANDING_ALLOWLIST.has(relPath(f)))

  const appFiles = findFiles(path.join(ZONGA_ROOT, 'app'), ['.tsx', '.ts'])

  const surfaceFiles = [...componentFiles, ...appFiles]

  it('no hardcoded brand icon spans outside branding components', () => {
    // Pattern: a <span> or <div> containing just "Z" that looks like a brand icon
    const brandIconPattern = /className=.*(?:bg-electric|from-electric).*>\s*(?:<span[^>]*>)?Z<\/span>/g
    const violations: string[] = []

    for (const file of surfaceFiles) {
      const content = fs.readFileSync(file, 'utf-8')
      const rel = relPath(file)

      // Skip test files
      if (rel.includes('.test.') || rel.includes('__test')) continue

      const matches = content.match(brandIconPattern)
      if (matches) {
        violations.push(`${rel}: found ${matches.length} hardcoded brand icon(s)`)
      }
    }

    expect(violations, `Hardcoded brand icons found — use ZongaBrandMark component instead:\n${violations.join('\n')}`).toHaveLength(0)
  })

  it('no inline "Zonga" brand text with direct styling outside branding components', () => {
    // Pattern: <span className="...font-bold...">Zonga</span> (inline styled brand text)
    const brandTextPattern = /<span\s+className="[^"]*font-bold[^"]*"[^>]*>\s*Zonga\s*<\/span>/g
    const violations: string[] = []

    for (const file of surfaceFiles) {
      const content = fs.readFileSync(file, 'utf-8')
      const rel = relPath(file)

      if (rel.includes('.test.') || rel.includes('__test')) continue

      const matches = content.match(brandTextPattern)
      if (matches) {
        violations.push(`${rel}: found ${matches.length} inline brand text(s)`)
      }
    }

    expect(violations, `Inline brand text found — use ZongaBrandMark or WorkspaceIdentity instead:\n${violations.join('\n')}`).toHaveLength(0)
  })

  it('branding components barrel export exists and is complete', () => {
    const barrelPath = path.join(ZONGA_ROOT, 'components/branding/index.ts')
    expect(fs.existsSync(barrelPath), 'Barrel export missing').toBe(true)

    const barrel = fs.readFileSync(barrelPath, 'utf-8')
    const required = ['ZongaBrandMark', 'ExternalBrandMark', 'WorkspaceIdentity', 'PartnershipAttribution', 'TrustStrip']
    for (const name of required) {
      expect(barrel, `Missing export: ${name}`).toContain(name)
    }
  })

  it('branding lib barrel export exists and is complete', () => {
    const barrelPath = path.join(ZONGA_ROOT, 'lib/branding/index.ts')
    expect(fs.existsSync(barrelPath), 'Barrel export missing').toBe(true)

    const barrel = fs.readFileSync(barrelPath, 'utf-8')
    const required = [
      'ZONGA_BRAND', 'evaluateBrandPolicy', 'canRenderBrand',
      'getSafeBrandMode', 'loadBrandingFlags', 'BRAND_POLICY_MATRIX',
      'buildAttribution', 'detectWhiteLabelViolations',
    ]
    for (const name of required) {
      expect(barrel, `Missing export: ${name}`).toContain(name)
    }
  })

  it('auth-page-layout derives brand from registry', () => {
    const layoutPath = path.join(ZONGA_ROOT, 'components/auth/auth-page-layout.tsx')
    const content = fs.readFileSync(layoutPath, 'utf-8')
    expect(content, 'auth-page-layout should import from branding registry').toContain('ZONGA_BRAND')
  })

  it('dashboard layout uses WorkspaceIdentity', () => {
    // Check all dashboard layout files
    const layouts = findFiles(path.join(ZONGA_ROOT, 'app'), ['.tsx'])
      .filter((f) => f.includes('dashboard') && f.endsWith('layout.tsx'))

    for (const layout of layouts) {
      const content = fs.readFileSync(layout, 'utf-8')
      const rel = relPath(layout)
      expect(content, `${rel} should use WorkspaceIdentity`).toContain('WorkspaceIdentity')
    }
  })

  it('site footer uses governed branding', () => {
    const footerPath = path.join(ZONGA_ROOT, 'components/public/site-footer.tsx')
    const content = fs.readFileSync(footerPath, 'utf-8')
    expect(content, 'Footer should import from branding components').toContain('ZongaBrandMark')
    expect(content, 'Footer should include PartnershipAttribution').toContain('PartnershipAttribution')
  })

  it('site navigation uses governed branding', () => {
    const navPath = path.join(ZONGA_ROOT, 'components/public/site-navigation.tsx')
    const content = fs.readFileSync(navPath, 'utf-8')
    expect(content, 'Navigation should use ZongaBrandMark').toContain('ZongaBrandMark')
  })

  it('about page uses PartnershipAttribution', () => {
    const aboutPath = path.join(ZONGA_ROOT, 'app/(marketing)/about/page.tsx')
    const content = fs.readFileSync(aboutPath, 'utf-8')
    expect(content, 'About page should import PartnershipAttribution').toContain('PartnershipAttribution')
    expect(content, 'About page should use about placement').toContain("placement=\"about\"")
  })

  it('contact page uses PartnershipAttribution with support placement', () => {
    const contactPath = path.join(ZONGA_ROOT, 'app/(marketing)/contact/page.tsx')
    const content = fs.readFileSync(contactPath, 'utf-8')
    expect(content, 'Contact page should import PartnershipAttribution').toContain('PartnershipAttribution')
    expect(content, 'Contact page should use support placement').toContain("placement=\"support\"")
  })

  it('case study page exists and uses governance', () => {
    const casePath = path.join(ZONGA_ROOT, 'app/(marketing)/case-studies/page.tsx')
    expect(fs.existsSync(casePath), 'Case study page should exist').toBe(true)
    const content = fs.readFileSync(casePath, 'utf-8')
    expect(content, 'Case study should use PartnershipAttribution').toContain('PartnershipAttribution')
    expect(content, 'Case study should use marketing_case_study placement').toContain("placement=\"marketing_case_study\"")
  })

  it('brand-config module registers real client and partner brands', () => {
    const configPath = path.join(ZONGA_ROOT, 'lib/branding/brand-config.ts')
    expect(fs.existsSync(configPath), 'Brand config should exist').toBe(true)
    const content = fs.readFileSync(configPath, 'utf-8')
    expect(content, 'Should define CLIENT_BRAND').toContain('CLIENT_BRAND')
    expect(content, 'Should define PARTNER_BRAND').toContain('PARTNER_BRAND')
    expect(content, 'Client should have role client').toContain("role: 'client'")
    expect(content, 'Partner should have role partner').toContain("role: 'partner'")
  })

  it('branding lib barrel exports brand-config symbols', () => {
    const barrelPath = path.join(ZONGA_ROOT, 'lib/branding/index.ts')
    const barrel = fs.readFileSync(barrelPath, 'utf-8')
    const required = ['CLIENT_BRAND', 'PARTNER_BRAND', 'initializeBrands', 'getClientBrand', 'getPartnerBrand']
    for (const name of required) {
      expect(barrel, `Missing export: ${name}`).toContain(name)
    }
  })
})

// ── Hard Misuse Enforcement ─────────────────────────────────────────────────
// These tests FAIL CI when branding governance is violated.

describe('Brand Misuse Enforcement (CI gate)', () => {
  const componentFiles = findFiles(path.join(ZONGA_ROOT, 'components'), ['.tsx', '.ts'])
    .filter((f) => !BRANDING_ALLOWLIST.has(relPath(f)))
  const appFiles = findFiles(path.join(ZONGA_ROOT, 'app'), ['.tsx', '.ts'])
  const allSurfaceFiles = [...componentFiles, ...appFiles]
    .filter((f) => !relPath(f).includes('.test.') && !relPath(f).includes('__test'))

  it('no direct import of client/partner brand assets outside branding system', () => {
    // Only brand-config.ts and lib/branding/* should reference brand asset paths
    // Surface files should use getClientBrand()/getPartnerBrand() not raw logoUrl strings
    const assetPathPattern = /['"]\/branding\/(clients|partners)\//g
    const violations: string[] = []

    for (const file of allSurfaceFiles) {
      const rel = relPath(file)
      if (BRANDING_ALLOWLIST.has(rel)) continue
      const content = fs.readFileSync(file, 'utf-8')
      const matches = content.match(assetPathPattern)
      if (matches) {
        violations.push(`${rel}: direct brand asset path (${matches.length} occurrence(s)) — use brand-config accessors`)
      }
    }

    expect(violations, `Direct brand asset imports found outside branding system:\n${violations.join('\n')}`).toHaveLength(0)
  })

  it('no raw <img>/<Image> tags rendering external logos outside ExternalBrandMark', () => {
    // External brand logos must render through ExternalBrandMark (policy-enforced)
    // Look for img/Image src referencing brand/client/partner paths
    const rawLogoPattern = /<(?:img|Image)\s[^>]*src=.*(?:client|partner|ms-celebration|rock-power)/gi
    const violations: string[] = []

    for (const file of allSurfaceFiles) {
      const rel = relPath(file)
      if (BRANDING_ALLOWLIST.has(rel)) continue
      const content = fs.readFileSync(file, 'utf-8')
      const matches = content.match(rawLogoPattern)
      if (matches) {
        violations.push(`${rel}: raw logo rendering (${matches.length}) — use ExternalBrandMark component`)
      }
    }

    expect(violations, `Raw external brand logos found — must use ExternalBrandMark:\n${violations.join('\n')}`).toHaveLength(0)
  })

  it('no partner/client branding in forbidden header/sidebar/dashboard/hero placements', () => {
    // Scan for placement="app_header"|"app_sidebar"|"app_dashboard"|"marketing_hero"
    // combined with client/partner props — forbidden by policy
    const forbiddenPlacements = ['app_header', 'app_sidebar', 'app_dashboard', 'marketing_hero']
    const violations: string[] = []

    for (const file of allSurfaceFiles) {
      const rel = relPath(file)
      if (BRANDING_ALLOWLIST.has(rel)) continue
      const content = fs.readFileSync(file, 'utf-8')

      for (const placement of forbiddenPlacements) {
        // Look for ExternalBrandMark or PartnershipAttribution with forbidden placement
        // that also has partner prop (partner in these placements is always forbidden)
        const hasPlacement = content.includes(`placement="${placement}"`)
        if (!hasPlacement) continue

        // Check for partner branding in forbidden product-chrome placements
        const hasPartnerProp = content.includes('partner={') || content.includes('partner=')
        if (hasPartnerProp && (placement === 'app_header' || placement === 'app_sidebar' || placement === 'app_dashboard')) {
          // Only flag if it's ExternalBrandMark with partner — PartnershipAttribution handles hiding via policy
          const externalBrandMarkWithPlacement = new RegExp(
            `<ExternalBrandMark[^>]*placement=["']${placement}["'][^>]*role=["']partner["']`,
          )
          if (externalBrandMarkWithPlacement.test(content)) {
            violations.push(`${rel}: partner ExternalBrandMark in forbidden placement "${placement}"`)
          }
        }
      }
    }

    expect(violations, `Forbidden placement violations:\n${violations.join('\n')}`).toHaveLength(0)
  })

  it('root layout calls initializeBrands()', () => {
    const layoutPath = path.join(ZONGA_ROOT, 'app/layout.tsx')
    const content = fs.readFileSync(layoutPath, 'utf-8')
    expect(content, 'Root layout must call initializeBrands() for runtime registration').toContain('initializeBrands')
  })

  it('homepage trust strip receives real brands (not empty array)', () => {
    const homePath = path.join(ZONGA_ROOT, 'app/(marketing)/page.tsx')
    const content = fs.readFileSync(homePath, 'utf-8')
    expect(content, 'TrustStrip must not receive brands={[]}').not.toContain('brands={[]}')
    expect(content, 'Homepage should resolve brands via brand-config').toContain('getClientBrand')
  })

  it('footer passes deployment brands to PartnershipAttribution', () => {
    const footerPath = path.join(ZONGA_ROOT, 'components/public/site-footer.tsx')
    const content = fs.readFileSync(footerPath, 'utf-8')
    expect(content, 'Footer PartnershipAttribution must receive client prop').toContain('client={')
    expect(content, 'Footer PartnershipAttribution must receive partner prop').toContain('partner={')
  })

  it('no direct registerBrand() calls outside brand-config.ts', () => {
    // registerBrand should only be called in brand-config.ts / test files
    const violations: string[] = []

    for (const file of allSurfaceFiles) {
      const rel = relPath(file)
      if (BRANDING_ALLOWLIST.has(rel)) continue
      const content = fs.readFileSync(file, 'utf-8')
      if (content.includes('registerBrand(') || content.includes('registerBrand (')) {
        violations.push(`${rel}: direct registerBrand() call — use initializeBrands() from brand-config`)
      }
    }

    expect(violations, `Direct registerBrand() calls found:\n${violations.join('\n')}`).toHaveLength(0)
  })
})
