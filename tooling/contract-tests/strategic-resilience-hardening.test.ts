import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { ROOT } from './governance-helpers'

describe('Strategic resilience hardening', () => {
  it('validator runs and produces report', () => {
    const workDir = mkdtempSync(join(tmpdir(), 'resilience-hardening-'))
    const reportPath = join(ROOT, 'ops', 'outputs', 'strategic-resilience-report.json')

    try {
      execFileSync('node', ['tooling/scripts/validate-strategic-resilience.mjs'], {
        cwd: ROOT,
        env: {
          ...process.env,
          RESILIENCE_MAX_REVIEW_AGE_DAYS: '365',
        },
        stdio: 'pipe',
      })

      expect(existsSync(reportPath)).toBe(true)
      const payload = JSON.parse(readFileSync(reportPath, 'utf-8'))
      expect(payload.total).toBeTypeOf('number')
      expect(payload.total).toBeGreaterThan(0)
      expect(Array.isArray(payload.checks)).toBe(true)
    } finally {
      rmSync(workDir, { recursive: true, force: true })
    }
  })

  it('enforce mode passes with current baseline', () => {
    expect(() => {
      execFileSync('node', ['tooling/scripts/validate-strategic-resilience.mjs', '--enforce'], {
        cwd: ROOT,
        env: {
          ...process.env,
          RESILIENCE_MAX_REVIEW_AGE_DAYS: '365',
        },
        stdio: 'pipe',
      })
    }).not.toThrow()
  })
})
