import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const CI_WORKFLOW = join(ROOT, '.github', 'workflows', 'ci.yml')
const OBS_TEST = join(ROOT, 'tooling', 'contract-tests', 'observability-coverage.test.ts')
const TELEMETRY_TEST = join(ROOT, 'tooling', 'contract-tests', 'telemetry-coverage.test.ts')

function readContent(filePath: string): string {
  return readFileSync(filePath, 'utf-8')
}

describe('Observability metric enforcement', () => {
  it('keeps contract tests for observability and telemetry coverage', () => {
    expect(existsSync(OBS_TEST)).toBe(true)
    expect(existsSync(TELEMETRY_TEST)).toBe(true)
  })

  it('CI collects and uploads DORA, onboarding, residency, and runtime-budget metrics', () => {
    expect(existsSync(CI_WORKFLOW)).toBe(true)

    const source = readContent(CI_WORKFLOW)
    expect(source).toContain('Collect DORA metrics')
    expect(source).toContain('Collect onboarding KPIs')
    expect(source).toContain('Verify runtime data residency (report)')
    expect(source).toContain('Enforce governance runtime budget')
    expect(source).toContain('ops/outputs/dora-metrics.json')
    expect(source).toContain('ops/outputs/onboarding-kpis.json')
    expect(source).toContain('ops/outputs/data-residency-runtime.json')
    expect(source).toContain('ops/outputs/governance-runtime-budget.json')
  })

  it('publishes observability evidence as artifacts for review', () => {
    const source = readContent(CI_WORKFLOW)

    expect(source).toContain('name: Upload governance gate report')
    expect(source).toContain('uses: actions/upload-artifact@v4')
    expect(source).toContain('name: governance-gate-report')
    expect(source).toContain('proof-artifacts/**')
  })
})