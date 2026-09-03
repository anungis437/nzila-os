import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const APP_ROOT = resolve(__dirname, '..', '..')
const REPO_ROOT = resolve(APP_ROOT, '..', '..')
const TSX_CLI = resolve(REPO_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs')
const REPORT_JSON = resolve(REPO_ROOT, 'reports', 'union-eyes-authority-convergence-report.json')
const REPORT_MD = resolve(REPO_ROOT, 'reports', 'union-eyes-authority-convergence-report.md')

describe('generate-authority-convergence-report', () => {
  it('runs and produces a valid, internally-consistent JSON + Markdown report', () => {
    expect(existsSync(TSX_CLI), 'tsx CLI entrypoint must exist so the generator is actually executed').toBe(true)

    execFileSync(process.execPath, [TSX_CLI, 'scripts/generate-authority-convergence-report.ts'], {
      cwd: APP_ROOT,
      stdio: 'pipe',
    })

    expect(existsSync(REPORT_JSON)).toBe(true)
    expect(existsSync(REPORT_MD)).toBe(true)

    const report = JSON.parse(readFileSync(REPORT_JSON, 'utf8'))
    expect(typeof report.totalTables).toBe('number')
    expect(report.totalTables).toBeGreaterThan(0)
    expect(report.invariantViolations.systemOnlyExposedToTenantRuntime).toBe(0)
    expect(report.invariantViolations.latentUnreachableExposedToAnyRole).toBe(0)

    const sumByClassification = Object.values(report.byClassification as Record<string, number>).reduce(
      (a, b) => a + b,
      0,
    )
    expect(sumByClassification).toBe(report.totalTables)

    const md = readFileSync(REPORT_MD, 'utf8')
    expect(md).toContain('Storage Authority Convergence Report')
    expect(md).toContain('Blanket grant blocker')
  })
})
