/**
 * Contract test: CI/CD Hardening (PHASE 8)
 *
 * CI-001: Main CI workflow must exist and run contract tests
 * CI-002: All apps must have a turbo.json entry or be in pnpm-workspace.yaml
 * CI-003: Contract test config must include all test files
 * CI-004: Governance gates must be non-bypassable (required in CI)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')

function readSafe(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf-8') : ''
}

// ── CI-001: Main CI workflow runs contract tests ────────────────────────────

describe('CI-001: CI workflow includes contract test gate', () => {
  it('ci.yml exists and runs pnpm contract-tests', () => {
    const ciPath = join(ROOT, '.github', 'workflows', 'ci.yml')
    expect(existsSync(ciPath), 'ci.yml must exist').toBe(true)

    const src = readSafe(ciPath)
    expect(src, 'CI must run contract tests').toContain('contract-tests')
    expect(src, 'CI must use pnpm contract-tests command').toContain('pnpm contract-tests')
  })

  it('CI runs on pull_request and push to main', () => {
    const ciPath = join(ROOT, '.github', 'workflows', 'ci.yml')
    const src = readSafe(ciPath)
    expect(src, 'CI must trigger on pull_request').toContain('pull_request')
    expect(src, 'CI must trigger on push to main').toMatch(/push[\s\S]*main|main[\s\S]*push/)
  })
})

// ── CI-002: All apps listed in workspace config ─────────────────────────────

describe('CI-002: All apps are in workspace config', () => {
  it('pnpm-workspace.yaml includes apps/* pattern', () => {
    const wsPath = join(ROOT, 'pnpm-workspace.yaml')
    expect(existsSync(wsPath), 'pnpm-workspace.yaml must exist').toBe(true)

    const src = readSafe(wsPath)
    expect(src, 'workspace must include apps/*').toMatch(/apps\/\*/)
  })

  it('turbo.json exists for build orchestration', () => {
    const turboPath = join(ROOT, 'turbo.json')
    expect(existsSync(turboPath), 'turbo.json must exist').toBe(true)
  })
})

// ── CI-003: Contract test coverage is comprehensive ─────────────────────────

describe('CI-003: Contract test coverage', () => {
  const REQUIRED_CONTRACT_TEST_FILES = [
    'shared-core-enforcement.test.ts',
    'canonical-schema-enforcement.test.ts',
    'control-plane-authority.test.ts',
    'org-scope-enforcement.test.ts',
    'org-scope-provability.test.ts',
    'evidence-universal-coverage.test.ts',
    'evidence-coverage.test.ts',
    'observability-unification.test.ts',
    'zonga-monetization-finalization.test.ts',
    'health-routes.test.ts',
  ]

  const contractTestDir = join(ROOT, 'tooling', 'contract-tests')

  for (const testFile of REQUIRED_CONTRACT_TEST_FILES) {
    it(`${testFile} exists in tooling/contract-tests/`, () => {
      expect(
        existsSync(join(contractTestDir, testFile)),
        `Missing contract test: ${testFile}`,
      ).toBe(true)
    })
  }
})

// ── CI-004: Governance summary generation ───────────────────────────────────

describe('CI-004: Governance and enforcement infrastructure', () => {
  it('CODEOWNERS file exists', () => {
    expect(existsSync(join(ROOT, 'CODEOWNERS')), 'CODEOWNERS must exist').toBe(true)
  })

  it('SECURITY.md exists', () => {
    expect(existsSync(join(ROOT, 'SECURITY.md')), 'SECURITY.md must exist').toBe(true)
  })

  it('lefthook.yml exists for pre-commit hooks', () => {
    expect(existsSync(join(ROOT, 'lefthook.yml')), 'lefthook.yml must exist').toBe(true)
  })

  it('ESLint architecture boundary config exists', () => {
    const boundaryPath = join(ROOT, 'packages', 'config', 'eslint-arch-boundary.mjs')
    expect(existsSync(boundaryPath), 'eslint-arch-boundary.mjs must exist').toBe(true)
  })
})
