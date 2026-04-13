/**
 * Contract Test — Platform Adoption Exception Registry
 *
 * Validates that governance/exceptions/platform-adoption-exceptions.json:
 *   EXC-01: Conforms to exception-schema.json structure
 *   EXC-02: Every entry references an existing app path
 *   EXC-03: No exception has expired (expiresOn is in the future)
 *   EXC-04: Every app listed as an exception actually lacks the stated package
 *   EXC-05: No duplicate entries (same path + package combination)
 *
 * @invariant GOV-EXCEPTION: All platform adoption exceptions must be valid, current, and accurate
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const REGISTRY_PATH = join(ROOT, 'governance', 'exceptions', 'platform-adoption-exceptions.json')

interface ExceptionEntry {
  path: string
  package: string
  owner: string
  justification: string
  expiresOn: string
}

interface ExceptionRegistry {
  ruleId: string
  description: string
  entries: ExceptionEntry[]
}

const registry: ExceptionRegistry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'))

// ── EXC-01: Schema conformance ──────────────────────────────────────────────

describe('EXC-01 — Registry conforms to exception schema', () => {
  it('has required top-level fields', () => {
    expect(registry.ruleId).toBeDefined()
    expect(typeof registry.ruleId).toBe('string')
    expect(registry.description).toBeDefined()
    expect(typeof registry.description).toBe('string')
    expect(Array.isArray(registry.entries)).toBe(true)
  })

  it('every entry has required fields', () => {
    for (const entry of registry.entries) {
      expect(entry.path).toBeDefined()
      expect(entry.owner).toBeDefined()
      expect(entry.justification).toBeDefined()
      expect(entry.expiresOn).toBeDefined()
      expect(entry.package).toBeDefined()
    }
  })

  it('every expiresOn is a valid YYYY-MM-DD date', () => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    for (const entry of registry.entries) {
      expect(entry.expiresOn).toMatch(dateRegex)
      expect(new Date(entry.expiresOn).toString()).not.toBe('Invalid Date')
    }
  })
})

// ── EXC-02: Every entry references an existing app ──────────────────────────

describe('EXC-02 — Every exception references an existing app path', () => {
  for (const entry of registry.entries) {
    it(`${entry.path} exists on disk`, () => {
      const fullPath = join(ROOT, entry.path)
      expect(existsSync(fullPath)).toBe(true)
    })
  }
})

// ── EXC-03: No expired exceptions ───────────────────────────────────────────

describe('EXC-03 — No exception has expired', () => {
  const today = new Date().toISOString().slice(0, 10)

  for (const entry of registry.entries) {
    it(`${entry.path} / ${entry.package} expires ${entry.expiresOn} (must be future)`, () => {
      expect(entry.expiresOn >= today).toBe(true)
    })
  }
})

// ── EXC-04: App actually lacks the stated package ───────────────────────────

describe('EXC-04 — Exception apps actually lack the stated package', () => {
  for (const entry of registry.entries) {
    it(`${entry.path} does not depend on @nzila/${entry.package}`, () => {
      const pkgPath = join(ROOT, entry.path, 'package.json')
      if (!existsSync(pkgPath)) return // non-JS app, skip
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      }
      expect(allDeps[`@nzila/${entry.package}`]).toBeUndefined()
    })
  }
})

// ── EXC-05: No duplicate entries ────────────────────────────────────────────

describe('EXC-05 — No duplicate path+package combinations', () => {
  it('all entries are unique', () => {
    const keys = registry.entries.map((e) => `${e.path}::${e.package}`)
    const uniqueKeys = new Set(keys)
    expect(keys.length).toBe(uniqueKeys.size)
  })
})
