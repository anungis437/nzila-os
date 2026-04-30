/**
 * Contract Test — Privacy Data Inventory Integrity (PRIV-INV-01)
 *
 * Verifies `governance/privacy/data-inventory.json` is internally
 * consistent and that:
 *   1. Every cross-border store declares a transfer mechanism
 *   2. Every store with personalData=true has at least one lawfulBasis
 *   3. Restricted-tier stores have explicit encryption mention
 *   4. linkedSurfaces (if any) reference real surfaces in
 *      governance/ai/inventory.json
 *   5. No duplicate ids
 *
 * This satisfies the "scheduled CI job (TODO)" referenced in
 * governance/privacy/policies/data-classification-standard.md.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')
const INV = resolve(ROOT, 'governance/privacy/data-inventory.json')
const AI_INV = resolve(ROOT, 'governance/ai/inventory.json')

interface DataStore {
  id: string
  highestDataTier: string
  personalData: boolean
  encryption: string
  lawfulBasis: string[]
  crossBorder: boolean
  transferMechanism?: string
  linkedSurfaces?: string[]
}

describe('Privacy data inventory integrity (PRIV-INV-01)', () => {
  it('data-inventory.json exists', () => {
    expect(existsSync(INV)).toBe(true)
  })

  const inv = JSON.parse(readFileSync(INV, 'utf-8')) as { dataStores: DataStore[] }

  it('has at least one data store', () => {
    expect(inv.dataStores.length).toBeGreaterThan(0)
  })

  it('has no duplicate store ids', () => {
    const ids = inv.dataStores.map(s => s.id)
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i)
    expect(dupes, `Duplicate data store ids: ${dupes.join(', ')}`).toEqual([])
  })

  for (const store of inv.dataStores) {
    describe(`store ${store.id}`, () => {
      if (store.personalData) {
        it('has at least one lawfulBasis', () => {
          expect(store.lawfulBasis.length).toBeGreaterThan(0)
        })
      }
      if (store.crossBorder) {
        it('declares a transferMechanism', () => {
          expect(
            store.transferMechanism,
            `${store.id}: cross-border store missing transferMechanism (SCCs / adequacy / DPA)`,
          ).toBeTruthy()
        })
      }
      if (store.highestDataTier === 'Restricted') {
        it('explicitly mentions encryption', () => {
          expect(store.encryption.length).toBeGreaterThan(0)
        })
      }
    })
  }

  // Cross-link: linkedSurfaces resolve against AI inventory
  if (existsSync(AI_INV)) {
    const ai = JSON.parse(readFileSync(AI_INV, 'utf-8')) as { surfaces: { id: string }[] }
    const validIds = new Set(ai.surfaces.map(s => s.id))

    it('linkedSurfaces all resolve to ai/inventory.json surfaces', () => {
      const broken: { store: string; surface: string }[] = []
      for (const store of inv.dataStores) {
        for (const sid of store.linkedSurfaces ?? []) {
          if (!validIds.has(sid)) broken.push({ store: store.id, surface: sid })
        }
      }
      expect(
        broken,
        `Broken linkedSurfaces references: ${broken.map(b => `${b.store}->${b.surface}`).join(', ')}`,
      ).toEqual([])
    })
  }
})
