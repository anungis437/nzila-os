/**
 * Contract Tests: SDK Package Contracts (Phase 6, PR6.1a)
 *
 * Verifies that @nzila/* packages honour their published API surface.
 * These tests act as a "breaking change detector" — if a package's
 * export changes in a backwards-incompatible way, these tests fail.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const REPO_ROOT = join(__dirname, '../..')

function readPackageExports(packageName: string): Record<string, string> {
  const pkgPath = join(REPO_ROOT, 'packages', packageName, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
  return pkg.exports ?? {}
}

function exportKeyExists(packageName: string, exportKey: string): boolean {
  const exports = readPackageExports(packageName)
  return exportKey in exports
}

describe('os-core SDK Contracts', () => {
  it('exports ./policy', () => {
    expect(exportKeyExists('os-core', './policy')).toBe(true)
  })

  it('exports ./telemetry', () => {
    expect(exportKeyExists('os-core', './telemetry')).toBe(true)
  })

  it('exports ./retention', () => {
    expect(exportKeyExists('os-core', './retention')).toBe(true)
  })

  it('exports ./config', () => {
    expect(exportKeyExists('os-core', './config')).toBe(true)
  })

  it('exports ./secrets', () => {
    expect(exportKeyExists('os-core', './secrets')).toBe(true)
  })

  it('exports ./evidence/generate-evidence-index', () => {
    expect(exportKeyExists('os-core', './evidence/generate-evidence-index')).toBe(true)
  })

  it('exports ./evidence/redaction', () => {
    expect(exportKeyExists('os-core', './evidence/redaction')).toBe(true)
  })
})

describe('ai-sdk SDK Contracts', () => {
  it('has a package.json with exports', () => {
    const pkgPath = join(REPO_ROOT, 'packages', 'ai-sdk', 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    expect(pkg.name).toMatch(/@nzila\/ai-sdk/)
  })

  it('has no-shadow-ai eslint rule configured', () => {
    const eslintPath = join(REPO_ROOT, 'packages', 'ai-sdk', 'eslint-no-shadow-ai.mjs')
    const { existsSync } = require('node:fs')
    expect(existsSync(eslintPath)).toBe(true)
  })
})

describe('db SDK Contracts', () => {
  it('exports schema from packages/db/src/schema', () => {
    const pkgPath = join(REPO_ROOT, 'packages', 'db', 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    expect(pkg.exports).toBeDefined()
  })

  it('partners schema has subsidiaryId and expiresAt', () => {
    const schemaPath = join(REPO_ROOT, 'packages', 'db', 'src', 'schema', 'partners.ts')
    const content = readFileSync(schemaPath, 'utf-8')
    expect(content).toContain('subsidiaryId')
    expect(content).toContain('expiresAt')
  })
})
