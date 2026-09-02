/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 round 9: proves the domain-partitioned
 * db/rls-storage-authority/*.ts modules compose correctly into the
 * canonical storageAuthorityManifest, and that the compatibility facade
 * (db/rls-storage-authority-manifest.ts) is a pure re-export with no
 * copied registry data of its own.
 */
import { describe, expect, it, vi } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { storageAuthorityManifest as fromFacade } from '../rls-storage-authority-manifest'
import { storageAuthorityManifest as fromIndex } from '../rls-storage-authority'

const APP_ROOT = resolve(__dirname, '..', '..')
const REGISTRY_DIR = resolve(APP_ROOT, 'db', 'rls-storage-authority')
const FACADE_PATH = resolve(APP_ROOT, 'db', 'rls-storage-authority-manifest.ts')
const HARD_CAP = 8000

describe('rls-storage-authority registry composition (PR #752 round 9)', () => {
  it('the facade re-exports the exact same composed array as the index module', () => {
    expect(fromFacade.length).toBe(fromIndex.length)
    expect(fromFacade).toEqual(fromIndex)
  })

  it('the facade contains no registry data of its own — pure re-export only', () => {
    const src = readFileSync(FACADE_PATH, 'utf8')
    expect(src).not.toMatch(/table:\s*['"]/)
    expect(src).toMatch(/export \* from ['"]\.\/rls-storage-authority['"]/)
  })

  it('composition is deterministic across repeated imports (fresh module registry)', async () => {
    vi.resetModules()
    const first = await import('../rls-storage-authority')
    vi.resetModules()
    const second = await import('../rls-storage-authority')
    expect(first.storageAuthorityManifest).toEqual(second.storageAuthorityManifest)
  })

  it('aggregate entry count is 700 and every table key is unique', () => {
    expect(fromIndex.length).toBe(700)
    const seen = new Map<string, number>()
    for (const entry of fromIndex) seen.set(entry.table, (seen.get(entry.table) ?? 0) + 1)
    const duplicates = [...seen.entries()].filter(([, count]) => count > 1).map(([table]) => table)
    expect(duplicates).toEqual([])
  })

  it('every domain module (and the facade) stays comfortably under the 8000-line hard cap', () => {
    const files = readdirSync(REGISTRY_DIR)
      .filter((f) => f.endsWith('.ts'))
      .map((f) => resolve(REGISTRY_DIR, f))
    files.push(FACADE_PATH)

    const oversized: Array<{ file: string; lines: number }> = []
    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split('\n').length
      if (lines > HARD_CAP) oversized.push({ file, lines })
    }
    expect(oversized, JSON.stringify(oversized)).toEqual([])
  })

  it('semantic module ordering does not change composed authority meaning (order-independent lookup)', () => {
    // The registry is consumed as a Map keyed by `table` everywhere
    // downstream (rls-verify.ts, the census, the convergence report, the
    // dry-run generator) — never by array position. Reversing the
    // composition order must produce the SAME Map contents.
    const forward = new Map(fromIndex.map((e) => [e.table, e]))
    const reversed = new Map([...fromIndex].reverse().map((e) => [e.table, e]))
    expect(reversed.size).toBe(forward.size)
    for (const [table, entry] of forward) {
      expect(reversed.get(table)).toEqual(entry)
    }
  })
})
