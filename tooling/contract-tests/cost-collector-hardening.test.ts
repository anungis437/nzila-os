import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { ROOT } from './governance-helpers'

describe('Cost collector hardening', () => {
  it('writes cost allocation output with source metadata', () => {
    const workDir = mkdtempSync(join(tmpdir(), 'cost-hardening-'))
    const outputPath = join(workDir, 'cost.json')

    try {
      execFileSync(
        'node',
        ['tooling/scripts/collect-cost-attribution.mjs'],
        {
          cwd: ROOT,
          env: {
            ...process.env,
            COST_OUTPUT_PATH: outputPath,
          },
          stdio: 'pipe',
        },
      )

      expect(existsSync(outputPath)).toBe(true)
      const payload = JSON.parse(readFileSync(outputPath, 'utf-8'))
      expect(payload.data_source).toBeTypeOf('string')
      expect(payload.unresolved_app_count).toBeTypeOf('number')
      expect(Array.isArray(payload.apps)).toBe(true)
      expect(payload.apps.length).toBeGreaterThan(0)
    } finally {
      rmSync(workDir, { recursive: true, force: true })
    }
  })

  it('fails closed when enforce-real-data is requested with unresolved apps', () => {
    const workDir = mkdtempSync(join(tmpdir(), 'cost-enforce-'))
    const outputPath = join(workDir, 'cost.json')

    try {
      expect(() => {
        execFileSync(
          'node',
          ['tooling/scripts/collect-cost-attribution.mjs', '--enforce-real-data'],
          {
            cwd: ROOT,
            env: {
              ...process.env,
              COST_OUTPUT_PATH: outputPath,
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
