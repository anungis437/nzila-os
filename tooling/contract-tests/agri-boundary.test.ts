/**
 * Contract Test — Agri Domain Boundary
 *
 * AGRI_DOMAIN_BOUNDARY_003:
 *   1. agri-core must NOT import from apps/ or other verticals
 *   2. agri-db must only depend on agri-core for types
 *   3. agri-events must only depend on agri-core for types
 *   4. agri-intelligence must only depend on agri-core for types
 *   5. agri-traceability must depend on agri-core + evidence
 *   6. No cross-vertical imports (trade → agri or agri → trade)
 *
 * @invariant AGRI_DOMAIN_BOUNDARY_003
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '../..')

function getAllTsFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      files.push(...getAllTsFiles(join(dir, entry.name)))
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      files.push(join(dir, entry.name))
    }
  }
  return files
}

describe('AGRI-BOUND-01 — agri-core has no app imports', () => {
  const files = getAllTsFiles(join(ROOT, 'packages', 'agri-core', 'src'))
  for (const file of files) {
    it(`${file.replace(ROOT, '')} does not import from apps/`, () => {
      const content = readFileSync(file, 'utf-8')
      expect(content).not.toMatch(/from\s+['"].*apps\//)
    })
  }
})

describe('AGRI-BOUND-02 — No cross-vertical imports (agri → trade)', () => {
  const agriPackages = [
    'agri-core',
    'agri-db',
    'agri-events',
    'agri-intelligence',
    'agri-traceability',
    'agri-adapters',
  ]

  for (const pkg of agriPackages) {
    const files = getAllTsFiles(join(ROOT, 'packages', pkg, 'src'))
    for (const file of files) {
      it(`${pkg}: ${file.replace(ROOT, '')} does not import trade packages`, () => {
        const content = readFileSync(file, 'utf-8')
        expect(content).not.toContain('@nzila/trade-core')
        expect(content).not.toContain('@nzila/trade-db')
        expect(content).not.toContain('@nzila/commerce-core')
      })
    }
  }
})

describe('AGRI-BOUND-03 — agri-core package.json has no app deps', () => {
  it('agri-core package.json has no @nzila/agrimo or @nzila/cora dep', () => {
    const pkgPath = join(ROOT, 'packages', 'agri-core', 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    }
    expect(allDeps).not.toHaveProperty('@nzila/agrimo')
    expect(allDeps).not.toHaveProperty('@nzila/cora')
  })
})
