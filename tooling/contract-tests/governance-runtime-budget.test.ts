import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { ROOT } from './governance-helpers'

describe('Governance runtime budget guardrail', () => {
  it('writes budget report in non-enforced mode', () => {
    const reportPath = join(ROOT, 'ops', 'outputs', 'governance-runtime-budget.json')
    execFileSync('node', ['tooling/scripts/check-governance-runtime-budget.mjs'], {
      cwd: ROOT,
      env: {
        ...process.env,
        GOVERNANCE_JOB_START_TS: String(Math.floor(Date.now() / 1000) - 120),
        GOVERNANCE_MAX_RUNTIME_MINUTES: '10',
      },
      stdio: 'pipe',
    })

    expect(existsSync(reportPath)).toBe(true)
    const payload = JSON.parse(readFileSync(reportPath, 'utf-8'))
    expect(payload.status).toMatch(/within_budget|over_budget|unknown/)
  })

  it('fails when enforce mode exceeds budget', () => {
    expect(() => {
      execFileSync('node', ['tooling/scripts/check-governance-runtime-budget.mjs', '--enforce'], {
        cwd: ROOT,
        env: {
          ...process.env,
          GOVERNANCE_JOB_START_TS: String(Math.floor(Date.now() / 1000) - 3600),
          GOVERNANCE_MAX_RUNTIME_MINUTES: '1',
        },
        stdio: 'pipe',
      })
    }).toThrowError()
  })
})
