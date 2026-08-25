/**
 * PR 15 — Coverage Gate Contract Tests
 *
 * Ensures that packages with business logic have coverage thresholds
 * configured and that the CI coverage job is wired up.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')

function readContent(path: string): string {
  try { return readFileSync(path, 'utf-8') } catch { return '' }
}

// Packages that MUST have test:coverage configured
const COVERAGE_REQUIRED_PACKAGES = [
  { name: '@nzila/payments-stripe', path: 'packages/payments-stripe' },
  { name: '@nzila/os-core', path: 'packages/os-core' },
  { name: '@nzila/ai-core', path: 'packages/ai-core' },
  { name: '@nzila/tools-runtime', path: 'packages/tools-runtime' },
]

describe('PR15: Coverage gates — test:coverage script', () => {
  it('turbo.json defines a test:coverage task', () => {
    const turboPath = resolve(ROOT, 'turbo.json')
    const content = readContent(turboPath)
    expect(
      content.includes('test:coverage'),
      'turbo.json must define a test:coverage task'
    ).toBe(true)
  })

  it('root package.json has test:coverage script', () => {
    const pkgPath = resolve(ROOT, 'package.json')
    const pkg = JSON.parse(readContent(pkgPath))
    expect(
      'test:coverage' in pkg.scripts,
      'root package.json must have test:coverage script'
    ).toBe(true)
  })

  it('root coverage script bounds turbo package concurrency', () => {
    const pkgPath = resolve(ROOT, 'package.json')
    const pkg = JSON.parse(readContent(pkgPath))
    expect(
      pkg.scripts['test:coverage'],
      'root package.json test:coverage must cap turbo concurrency for CI-sized runners'
    ).toMatch(/turbo test:coverage .*--concurrency=(?:\d+|\d+%)/)
  })

  it('Union Eyes coverage bounds its package-local worker fan-out', () => {
    const pkgPath = resolve(ROOT, 'apps/union-eyes/package.json')
    const pkg = JSON.parse(readContent(pkgPath))
    expect(
      pkg.scripts['test:coverage'],
      'Union Eyes coverage imports the large API route matrix and must cap Vitest workers'
    ).toContain('--maxWorkers=2')
  })
})

describe('PR15: Coverage gates — vitest coverage configuration', () => {
  for (const pkg of COVERAGE_REQUIRED_PACKAGES) {
    it(`${pkg.name} vitest.config.ts has coverage thresholds or test:coverage script`, () => {
      const vitestConfig = resolve(ROOT, pkg.path, 'vitest.config.ts')
      const pkgJson = resolve(ROOT, pkg.path, 'package.json')

      const hasVitestCoverage = existsSync(vitestConfig) &&
        readContent(vitestConfig).includes('coverage')

      const hasCoverageScript = existsSync(pkgJson) && (() => {
        const p = JSON.parse(readContent(pkgJson))
        return 'test:coverage' in (p.scripts || {})
      })()

      expect(
        hasVitestCoverage || hasCoverageScript,
        `${pkg.name} must have coverage config in vitest.config.ts or a test:coverage script`
      ).toBe(true)
    })
  }
})

describe('PR15: Coverage gates — CI coverage pipeline', () => {
  it('CI workflow runs tests', () => {
    const ciPath = resolve(ROOT, '.github/workflows/ci.yml')
    expect(existsSync(ciPath), '.github/workflows/ci.yml must exist').toBe(true)
    const content = readContent(ciPath)
    expect(
      content.includes('pnpm test') || content.includes('turbo test'),
      'CI must run tests'
    ).toBe(true)
  })
})
