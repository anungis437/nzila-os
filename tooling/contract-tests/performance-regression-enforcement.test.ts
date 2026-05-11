import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const CI_WORKFLOW = join(ROOT, '.github', 'workflows', 'ci.yml')
const LIGHTHOUSE_WORKFLOW = join(ROOT, '.github', 'workflows', 'lighthouse.yml')

function readContent(filePath: string): string {
  return readFileSync(filePath, 'utf-8')
}

describe('Performance regression enforcement', () => {
  it('CI workflow includes a fail-closed k6 performance gate', () => {
    expect(existsSync(CI_WORKFLOW)).toBe(true)

    const source = readContent(CI_WORKFLOW)
    expect(source).toContain('name: Performance Regression Gate')
    expect(source).toContain('Install k6')
    expect(source).toContain('Run k6 fail-closed performance gate')
    expect(source).toContain('--summary-export=tests/load/k6-summary.json')
    expect(source).toContain('tests/load/smoke.js')
    expect(source).toContain('AUTH_TOKEN="${{ secrets.PERF_AUTH_TOKEN }}"')
  })

  it('performance gate publishes artifacts for regression analysis', () => {
    const source = readContent(CI_WORKFLOW)

    expect(source).toContain('name: k6-perf-results')
    expect(source).toContain('path: tests/load/')
    expect(source).toContain('retention-days: 30')
  })

  it('Lighthouse workflow audits user-facing apps and uploads results', () => {
    expect(existsSync(LIGHTHOUSE_WORKFLOW)).toBe(true)

    const source = readContent(LIGHTHOUSE_WORKFLOW)
    expect(source).toContain('name: Lighthouse CI')
    expect(source).toContain('Run Lighthouse CI')
    expect(source).toContain('lhci autorun')
    expect(source).toContain('name: lighthouse-results-${{ github.run_id }}')
    expect(source).toContain("- 'apps/web/**'")
    expect(source).toContain("- 'apps/console/**'")
  })
})