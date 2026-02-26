/**
 * Contract Test — Zonga Server Actions
 *
 * Structural invariants:
 *   1. Every action file uses 'use server' directive
 *   2. Every action calls auth() for authentication
 *   3. Every mutating action integrates evidence pipeline
 *   4. Zonga actions use zonga-core audit types (buildZongaAuditEvent)
 *   5. Payout actions integrate Stripe Connect
 *   6. Actions use structured logger
 *
 * @invariant ZNG-ACT-01: Server action auth guard
 * @invariant ZNG-ACT-02: Evidence pipeline integration
 * @invariant ZNG-ACT-03: Zonga audit integration
 * @invariant ZNG-ACT-04: Stripe Connect payout flow
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '../..')
const ZONGA_ACTIONS = join(ROOT, 'apps', 'zonga', 'lib', 'actions')

const ACTION_FILES = [
  'catalog-actions.ts',
  'creator-actions.ts',
  'revenue-actions.ts',
  'payout-actions.ts',
  'release-actions.ts',
  'upload-actions.ts',
]

describe('ZNG-ACT — Server action files exist', () => {
  for (const file of ACTION_FILES) {
    it(`${file} exists`, () => {
      expect(existsSync(join(ZONGA_ACTIONS, file))).toBe(true)
    })
  }
})

describe('ZNG-ACT-01 — Every action file uses "use server" directive', () => {
  for (const file of ACTION_FILES) {
    it(`${file} has 'use server'`, () => {
      const path = join(ZONGA_ACTIONS, file)
      if (!existsSync(path)) return
      const content = readFileSync(path, 'utf-8')
      expect(content).toContain("'use server'")
    })
  }
})

describe('ZNG-ACT-01 — Every action file authenticates', () => {
  for (const file of ACTION_FILES) {
    it(`${file} authenticates via auth() or resolveOrgContext()`, () => {
      const path = join(ZONGA_ACTIONS, file)
      if (!existsSync(path)) return
      const content = readFileSync(path, 'utf-8')
      const hasDirectAuth =
        content.includes('auth()') && content.includes('@clerk/nextjs')
      const hasOrgContext = content.includes('resolveOrgContext')
      expect(
        hasDirectAuth || hasOrgContext,
        `${file} must call auth() (with @clerk/nextjs import) or resolveOrgContext()`,
      ).toBe(true)
    })
  }
})

describe('ZNG-ACT-02 — Mutating actions use evidence pipeline', () => {
  for (const file of ACTION_FILES) {
    it(`${file} integrates evidence pipeline`, () => {
      const path = join(ZONGA_ACTIONS, file)
      if (!existsSync(path)) return
      const content = readFileSync(path, 'utf-8')
      expect(content).toContain('buildEvidencePackFromAction')
      expect(content).toContain('processEvidencePack')
    })
  }
})

describe('ZNG-ACT-03 — Zonga actions use zonga-core audit types', () => {
  const AUDIT_FILES = [
    'catalog-actions.ts',
    'creator-actions.ts',
    'revenue-actions.ts',
    'payout-actions.ts',
    'release-actions.ts',
  ]

  for (const file of AUDIT_FILES) {
    it(`${file} uses buildZongaAuditEvent`, () => {
      const path = join(ZONGA_ACTIONS, file)
      if (!existsSync(path)) return
      const content = readFileSync(path, 'utf-8')
      expect(content).toContain('buildZongaAuditEvent')
    })

    it(`${file} imports ZongaAuditAction`, () => {
      const path = join(ZONGA_ACTIONS, file)
      if (!existsSync(path)) return
      const content = readFileSync(path, 'utf-8')
      expect(content).toContain('ZongaAuditAction')
    })
  }
})

describe('ZNG-ACT-04 — Payout actions use Stripe Connect', () => {
  it('payout-actions.ts imports Stripe payout function', () => {
    const path = join(ZONGA_ACTIONS, 'payout-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('executeCreatorPayout')
  })

  it('payout-actions.ts uses computePayoutPreview from zonga-core', () => {
    const path = join(ZONGA_ACTIONS, 'payout-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('computePayoutPreview')
    expect(content).toContain('@nzila/zonga-core')
  })
})

describe('ZNG-ACT — Catalog actions contract', () => {
  it('exports listCatalogAssets, createContentAsset, publishAsset, getAssetDetail', () => {
    const path = join(ZONGA_ACTIONS, 'catalog-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('export async function listCatalogAssets')
    expect(content).toContain('export async function createContentAsset')
    expect(content).toContain('export async function publishAsset')
    expect(content).toContain('export async function getAssetDetail')
  })
})

describe('ZNG-ACT — Creator actions contract', () => {
  it('exports listCreators, registerCreator, getCreatorDetail', () => {
    const path = join(ZONGA_ACTIONS, 'creator-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('export async function listCreators')
    expect(content).toContain('export async function registerCreator')
    expect(content).toContain('export async function getCreatorDetail')
  })
})

describe('ZNG-ACT — Revenue actions contract', () => {
  it('exports getRevenueOverview, recordRevenueEvent, getRevenueByCreator', () => {
    const path = join(ZONGA_ACTIONS, 'revenue-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('export async function getRevenueOverview')
    expect(content).toContain('export async function recordRevenueEvent')
    expect(content).toContain('export async function getRevenueByCreator')
  })
})

describe('ZNG-ACT — Release actions contract', () => {
  it('exports listReleases, createRelease, getAnalyticsOverview, getIntegrityChecks', () => {
    const path = join(ZONGA_ACTIONS, 'release-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('export async function listReleases')
    expect(content).toContain('export async function createRelease')
    expect(content).toContain('export async function getAnalyticsOverview')
    expect(content).toContain('export async function getIntegrityChecks')
  })

  it('getIntegrityChecks uses ML for content analysis', () => {
    const path = join(ZONGA_ACTIONS, 'release-actions.ts')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('runPrediction')
  })
})

describe('ZNG-ACT — All actions use structured logger', () => {
  for (const file of ACTION_FILES) {
    it(`${file} imports logger`, () => {
      const path = join(ZONGA_ACTIONS, file)
      if (!existsSync(path)) return
      const content = readFileSync(path, 'utf-8')
      expect(content).toContain('logger')
    })
  }
})

describe('ZNG-ACT — Mutating actions call revalidatePath', () => {
  const MUTATING_FILES = [
    'catalog-actions.ts',
    'creator-actions.ts',
    'revenue-actions.ts',
    'payout-actions.ts',
    'release-actions.ts',
  ]

  for (const file of MUTATING_FILES) {
    it(`${file} calls revalidatePath`, () => {
      const path = join(ZONGA_ACTIONS, file)
      if (!existsSync(path)) return
      const content = readFileSync(path, 'utf-8')
      expect(content).toContain('revalidatePath')
    })
  }
})

describe('ZNG-ACT — All actions use platformDb', () => {
  for (const file of ACTION_FILES) {
    it(`${file} imports platformDb`, () => {
      const path = join(ZONGA_ACTIONS, file)
      if (!existsSync(path)) return
      const content = readFileSync(path, 'utf-8')
      expect(content).toContain('platformDb')
    })
  }
})
