/**
 * Contract Test — GA Gate Required
 *
 * Structural invariant: The GA Gate v2 tooling must exist and be runnable.
 * This test fails if:
 *   - ga-check script is missing from package.json
 *   - ga-check entry point is missing
 *   - red-team workflow is missing
 *   - verifySeal is missing from governance workflow
 *   - report formatters are missing
 *
 * @invariant GA-GATE-REQUIRED: ga-check must be present and functional
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')

describe('GA Gate v2 — required infrastructure', () => {
  it('ga-check entry point exists', () => {
    const gaCheckPath = join(ROOT, 'tooling/ga-check/ga-check.ts')
    expect(existsSync(gaCheckPath), 'tooling/ga-check/ga-check.ts must exist').toBe(true)
  })

  it('ga-check types module exists', () => {
    const typesPath = join(ROOT, 'tooling/ga-check/types.ts')
    expect(existsSync(typesPath), 'tooling/ga-check/types.ts must exist').toBe(true)
  })

  it('ga-check report module exists', () => {
    const reportPath = join(ROOT, 'tooling/ga-check/report.ts')
    expect(existsSync(reportPath), 'tooling/ga-check/report.ts must exist').toBe(true)
  })

  it('pnpm ga-check script is defined in root package.json', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'))
    expect(pkg.scripts['ga-check']).toBeDefined()
    expect(pkg.scripts['ga-check']).toContain('ga-check')
  })

  it('red-team workflow exists', () => {
    const workflowPath = join(ROOT, '.github/workflows/red-team.yml')
    expect(existsSync(workflowPath), '.github/workflows/red-team.yml must exist').toBe(true)
  })

  it('governance workflow (nzila-governance.yml) exists', () => {
    const workflowPath = join(ROOT, '.github/workflows/nzila-governance.yml')
    expect(existsSync(workflowPath), 'nzila-governance.yml must exist').toBe(true)
  })

  it('governance workflow contains verifySeal or seal.json reference', () => {
    const workflowPath = join(ROOT, '.github/workflows/nzila-governance.yml')
    if (!existsSync(workflowPath)) return // covered by previous test

    const content = readFileSync(workflowPath, 'utf-8')
    const hasSealRef =
      content.includes('verifySeal') ||
      content.includes('verify-seal') ||
      content.includes('verify_seal') ||
      content.includes('seal.json')

    expect(hasSealRef, 'Governance workflow must reference verifySeal or seal.json').toBe(true)
  })

  it('ga-check entry point imports report formatters', () => {
    const gaCheckPath = join(ROOT, 'tooling/ga-check/ga-check.ts')
    const content = readFileSync(gaCheckPath, 'utf-8')

    expect(content).toContain('formatHumanReport')
    expect(content).toContain('formatMarkdownReport')
    expect(content).toContain('formatJsonReport')
  })

  it('ga-check outputs JSON to governance/ga/', () => {
    const gaCheckPath = join(ROOT, 'tooling/ga-check/ga-check.ts')
    const content = readFileSync(gaCheckPath, 'utf-8')

    expect(content).toContain('ga-check.json')
    expect(content).toContain('GA_CHECK_REPORT.md')
  })

  it('ga-check has no bypass flags', () => {
    const gaCheckPath = join(ROOT, 'tooling/ga-check/ga-check.ts')
    const content = readFileSync(gaCheckPath, 'utf-8')

    expect(content).toContain('NO BYPASS FLAGS')
    // Must not have --skip, --allow-failures, or SKIP_GA_CHECK
    expect(content).not.toMatch(/--skip|--allow-failures|SKIP_GA_CHECK/)
  })
})
