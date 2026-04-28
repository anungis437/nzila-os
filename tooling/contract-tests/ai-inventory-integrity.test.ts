/**
 * Contract Test — AI Inventory Integrity (AIGOV-INV-01)
 *
 * Verifies the machine-readable AI surface inventory at
 * `governance/ai/inventory.json` is internally consistent and that every
 * referenced artifact (PIA, eval dataset) actually exists on disk.
 *
 * This is the lifecycle gate referenced by
 * `governance/ai/lifecycle-gates.md` G1, G2, G3, G7.
 *
 * Failure modes caught:
 *   1. Inventory references a PIA file that does not exist
 *   2. Inventory references an eval dataset directory that does not exist
 *   3. Tier-1 surface in PROD/DEV missing AIGC approval (decision != 'approved')
 *   4. PROD surface missing a PIA (any tier > 3)
 *   5. App listed in inventory does not exist under apps/
 *   6. Duplicate surface ids
 *   7. Inventory does not validate against its JSON Schema (basic shape)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'

const ROOT = resolve(__dirname, '../..')
const INVENTORY_PATH = resolve(ROOT, 'governance/ai/inventory.json')

interface InventorySurface {
  id: string
  name: string
  app?: string
  package?: string
  owner: string
  riskTier: 0 | 1 | 2 | 3
  provider: string
  highestDataTier: 'Public' | 'Internal' | 'Confidential' | 'Restricted'
  pia?: string | null
  piaStatus?: string
  evalDataset?: string | null
  approval: { by: string; date: string | null; decision: string }
  status: 'DESIGN' | 'DEV' | 'PROD' | 'DEPRECATED' | 'RETIRED'
}

interface Inventory {
  version: string
  updated: string
  surfaces: InventorySurface[]
}

describe('AI inventory integrity (AIGOV-INV-01)', () => {
  it('inventory.json exists', () => {
    expect(existsSync(INVENTORY_PATH)).toBe(true)
  })

  const inv: Inventory = JSON.parse(readFileSync(INVENTORY_PATH, 'utf-8'))

  it('has at least one surface', () => {
    expect(Array.isArray(inv.surfaces)).toBe(true)
    expect(inv.surfaces.length).toBeGreaterThan(0)
  })

  it('has no duplicate surface ids', () => {
    const ids = inv.surfaces.map(s => s.id)
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i)
    expect(dupes, `Duplicate surface ids: ${dupes.join(', ')}`).toEqual([])
  })

  for (const s of inv.surfaces) {
    describe(`surface ${s.id}`, () => {
      it('has required fields', () => {
        expect(s.id).toMatch(/^[a-z0-9][a-z0-9-]*$/)
        expect(s.name).toBeTruthy()
        expect(s.owner).toBeTruthy()
        expect([0, 1, 2, 3]).toContain(s.riskTier)
        expect(['Public', 'Internal', 'Confidential', 'Restricted']).toContain(s.highestDataTier)
        expect(['DESIGN', 'DEV', 'PROD', 'DEPRECATED', 'RETIRED']).toContain(s.status)
      })

      if (s.app && s.status !== 'DESIGN') {
        it(`app "${s.app}" exists under apps/`, () => {
          expect(
            existsSync(resolve(ROOT, 'apps', s.app!)),
            `inventory references app "${s.app}" but apps/${s.app} does not exist`,
          ).toBe(true)
        })
      }

      if (s.package && s.package.startsWith('packages/')) {
        it(`package "${s.package}" exists`, () => {
          expect(existsSync(resolve(ROOT, s.package!))).toBe(true)
        })
      }

      if (s.pia) {
        it(`PIA file "${s.pia}" exists`, () => {
          expect(
            existsSync(resolve(ROOT, s.pia!)),
            `inventory references PIA "${s.pia}" but file does not exist`,
          ).toBe(true)
        })
      }

      if (s.evalDataset) {
        it(`eval dataset "${s.evalDataset}" exists`, () => {
          expect(
            existsSync(resolve(ROOT, s.evalDataset!)),
            `inventory references eval dataset "${s.evalDataset}" but path does not exist`,
          ).toBe(true)
        })
      }

      // ── Tier-1 in DEV/PROD must have AIGC approval (decision === 'approved') ──
      if (s.riskTier === 1 && (s.status === 'PROD' || s.status === 'DEV')) {
        it(`Tier-1 surface in ${s.status} must have AIGC approval (decision === 'approved')`, () => {
          // Allow 'pending' / 'required-before-launch' for DEV; PROD must be approved
          if (s.status === 'PROD') {
            expect(
              s.approval.decision,
              `${s.id}: Tier-1 PROD surface requires AIGC approval; current decision is "${s.approval.decision}"`,
            ).toBe('approved')
            expect(s.approval.by.toLowerCase()).toContain('aigc')
          } else {
            // DEV is allowed to be pending but must NOT be 'draft' — must be at least pending AIGC review
            expect(
              ['pending', 'required-before-launch', 'approved'],
              `${s.id}: Tier-1 DEV surface must be in AIGC pipeline; got "${s.approval.decision}"`,
            ).toContain(s.approval.decision)
          }
        })
      }

      // ── PROD surfaces touching personal data MUST have a PIA ──
      if (
        s.status === 'PROD' &&
        (s.highestDataTier === 'Confidential' || s.highestDataTier === 'Restricted')
      ) {
        it(`PROD surface with ${s.highestDataTier} data must have a PIA on file`, () => {
          expect(
            s.pia && existsSync(resolve(ROOT, s.pia)),
            `${s.id}: PROD surface handles ${s.highestDataTier} data but PIA is missing`,
          ).toBe(true)
        })
      }
    })
  }

  // ── Cross-check: every app declaring @nzila/ai-sdk SHOULD appear in inventory ──
  // Surfaced as a soft warning via test but not a hard fail (surfaces can be partial).
  it('every app declaring @nzila/ai-sdk has an inventory entry (soft check)', () => {
    const appsDir = resolve(ROOT, 'apps')
    if (!existsSync(appsDir)) return
    const inventoryApps = new Set(inv.surfaces.map(s => s.app).filter(Boolean) as string[])
    const fs = require('node:fs') as typeof import('node:fs')
    const apps = fs
      .readdirSync(appsDir, { withFileTypes: true })
      .filter((d: import('node:fs').Dirent) => d.isDirectory())
      .map((d: import('node:fs').Dirent) => d.name)
    const missing: string[] = []
    for (const app of apps) {
      const pkgJson = join(appsDir, app, 'package.json')
      if (!existsSync(pkgJson)) continue
      const pkg = JSON.parse(readFileSync(pkgJson, 'utf-8'))
      const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
      if (deps['@nzila/ai-sdk'] && !inventoryApps.has(app)) {
        missing.push(app)
      }
    }
    expect(
      missing,
      `Apps declaring @nzila/ai-sdk but missing from governance/ai/inventory.json: ${missing.join(', ')}`,
    ).toEqual([])
  })
})
