import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { ROOT } from './governance-helpers'

describe('Data residency runtime verifier', () => {
  it('generates a runtime report in non-enforced mode', () => {
    const reportPath = join(ROOT, 'ops', 'outputs', 'data-residency-runtime.json')

    execFileSync('node', ['tooling/scripts/verify-data-residency-runtime.mjs'], {
      cwd: ROOT,
      env: {
        ...process.env,
        RESIDENCY_ALLOWED_REGIONS: 'canadacentral,canadaeast',
      },
      stdio: 'pipe',
    })

    expect(existsSync(reportPath)).toBe(true)
    const payload = JSON.parse(readFileSync(reportPath, 'utf-8'))
    expect(payload.status).toMatch(/ok|violation|unverified/)
    expect(Array.isArray(payload.allowed_regions)).toBe(true)
  })
})
