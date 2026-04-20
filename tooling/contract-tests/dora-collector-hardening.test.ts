import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { ROOT } from './governance-helpers'

describe('DORA collector hardening', () => {
  it('writes a well-formed output document with predictive signal', { timeout: 120_000 }, () => {
    const workDir = mkdtempSync(join(tmpdir(), 'dora-hardening-'))
    const outputPath = join(workDir, 'dora.json')

    try {
      execFileSync(
        'node',
        ['tooling/scripts/collect-dora-metrics.mjs'],
        {
          cwd: ROOT,
          env: {
            ...process.env,
            DORA_OUTPUT_PATH: outputPath,
            DORA_WINDOW_DAYS: '30',
            DORA_LOOKBACK_WEEKS: '8',
          },
          stdio: 'pipe',
        },
      )

      expect(existsSync(outputPath)).toBe(true)
      const payload = JSON.parse(readFileSync(outputPath, 'utf-8'))
      expect(payload.metrics?.deployment_frequency?.value).toBeTypeOf('number')
      expect(payload.metrics?.change_failure_rate?.value).toBeTypeOf('number')
      expect(payload.metrics?.predictive_signal?.value).toMatch(/normal|elevated/)
      expect(Array.isArray(payload.metrics?.predictive_signal?.weekly_deploy_series)).toBe(true)
    } finally {
      rmSync(workDir, { recursive: true, force: true })
    }
  })

  it('fails closed when enforce mode threshold is violated', { timeout: 120_000 }, () => {
    const workDir = mkdtempSync(join(tmpdir(), 'dora-enforce-'))
    const outputPath = join(workDir, 'dora.json')

    try {
      expect(() => {
        execFileSync(
          'node',
          ['tooling/scripts/collect-dora-metrics.mjs', '--enforce'],
          {
            cwd: ROOT,
            env: {
              ...process.env,
              DORA_OUTPUT_PATH: outputPath,
              DORA_MIN_DEPLOYS_PER_WEEK: '9999',
            },
            stdio: 'pipe',
          },
        )
      }).toThrowError()

      expect(existsSync(outputPath)).toBe(true)
    } finally {
      rmSync(workDir, { recursive: true, force: true })
    }
  })
})
