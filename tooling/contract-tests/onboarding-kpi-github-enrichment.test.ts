import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { ROOT } from './governance-helpers'

describe('Onboarding KPI GitHub enrichment', () => {
  it('produces github_enrichment section without failing when API unavailable', () => {
    const outputPath = join(ROOT, 'ops', 'outputs', 'onboarding-kpis.json')

    execFileSync('node', ['tooling/scripts/collect-onboarding-kpis.mjs'], {
      cwd: ROOT,
      env: {
        ...process.env,
        ONBOARDING_GITHUB_REPO: 'anungis437/nzila-os',
        ONBOARDING_GITHUB_WINDOW_DAYS: '30',
      },
      stdio: 'pipe',
    })

    expect(existsSync(outputPath)).toBe(true)
    const payload = JSON.parse(readFileSync(outputPath, 'utf-8'))
    expect(payload.github_enrichment).toBeTruthy()
    expect(payload.github_enrichment.repo).toBe('anungis437/nzila-os')
    expect(Array.isArray(payload.github_enrichment.records)).toBe(true)
  })
})
