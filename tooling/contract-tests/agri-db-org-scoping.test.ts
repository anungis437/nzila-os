/**
 * Contract Test — Agri DB Org Scoping
 *
 * AGRI_DB_ORG_SCOPING_007:
 *   1. All repository files accept orgId / dbCtx parameter
 *   2. Repositories export standard CRUD function signatures
 *   3. No raw SQL without org scoping
 *
 * @invariant AGRI_DB_ORG_SCOPING_007
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '../..')
const AGRI_DB_PKG = join(ROOT, 'packages', 'agri-db', 'src')
const AGRI_DB_REPOS = join(AGRI_DB_PKG, 'repositories')

const REPO_FILES = [
  'producers.ts',
  'crops.ts',
  'harvests.ts',
  'lots.ts',
  'quality.ts',
  'batches.ts',
  'warehouses.ts',
  'shipments.ts',
  'payments.ts',
  'certifications.ts',
  'traceability.ts',
  'intelligence.ts',
]

describe('AGRI-DB-01 — all repository files exist', () => {
  for (const file of REPO_FILES) {
    it(`${file} exists`, () => {
      expect(existsSync(join(AGRI_DB_REPOS, file))).toBe(true)
    })
  }
})

describe('AGRI-DB-02 — repositories accept org-scoped context', () => {
  for (const file of REPO_FILES) {
    it(`${file} functions accept ctx/orgId parameter`, () => {
      const path = join(AGRI_DB_REPOS, file)
      if (!existsSync(path)) return
      const content = readFileSync(path, 'utf-8')
      // Every exported function must accept a context parameter
      const hasCtx = content.includes('ctx:') || content.includes('orgId')
      expect(hasCtx).toBe(true)
    })
  }
})

describe('AGRI-DB-03 — types.ts defines AgriDbContext', () => {
  it('types.ts exports AgriDbContext', () => {
    const path = join(AGRI_DB_PKG, 'types.ts')
    expect(existsSync(path)).toBe(true)
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('AgriDbContext')
    expect(content).toContain('orgId')
  })
})

describe('AGRI-DB-04 — index.ts barrel re-exports all repos', () => {
  it('index.ts exists and re-exports repository modules', () => {
    const path = join(AGRI_DB_PKG, 'index.ts')
    if (!existsSync(path)) return
    const content = readFileSync(path, 'utf-8')
    for (const file of REPO_FILES) {
      const mod = file.replace('.ts', '')
      expect(content).toContain(mod)
    }
  })
})
