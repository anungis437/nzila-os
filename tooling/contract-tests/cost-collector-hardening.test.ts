import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

  it('invokes Azure CLI through the platform command shim', () => {
    const workDir = mkdtempSync(join(tmpdir(), 'cost-azure-cli-'))
    const outputPath = join(workDir, 'cost.json')
    const fixturePath = join(workDir, 'azure-cost-response.json')
    const response = {
      properties: {
        rows: [[123.45, 'nzila-canada-staging-rg', 'USD']],
      },
    }

    try {
      writeFileSync(fixturePath, JSON.stringify(response))
      if (process.platform === 'win32') {
        writeFileSync(join(workDir, 'az.cmd'), `@echo off\r\ntype "${fixturePath}"\r\n`)
      } else {
        const shimPath = join(workDir, 'az')
        writeFileSync(shimPath, `#!/bin/sh\ncat "${fixturePath}"\n`)
        chmodSync(shimPath, 0o755)
      }

      execFileSync(
        process.execPath,
        ['tooling/scripts/collect-cost-attribution.mjs', '--enable-azure-api'],
        {
          cwd: ROOT,
          env: {
            ...process.env,
            PATH: `${workDir}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH ?? ''}`,
            AZURE_SUBSCRIPTION_ID: '00000000-0000-0000-0000-000000000000',
            COST_OUTPUT_PATH: outputPath,
          },
          stdio: 'pipe',
        },
      )

      const payload = JSON.parse(readFileSync(outputPath, 'utf-8'))
      expect(payload.data_source).toBe('azure-cost-management-api')
      expect(payload.total_monthly_cost_usd).toBe(123.45)
      expect(payload.errors).toEqual([])
    } finally {
      rmSync(workDir, { recursive: true, force: true })
    }
  })

  it('reports Azure CLI process launch errors', () => {
    const workDir = mkdtempSync(join(tmpdir(), 'cost-azure-cli-error-'))
    const outputPath = join(workDir, 'cost.json')

    try {
      execFileSync(
        process.execPath,
        ['tooling/scripts/collect-cost-attribution.mjs', '--enable-azure-api'],
        {
          cwd: ROOT,
          env: {
            ...process.env,
            PATH: '',
            AZURE_SUBSCRIPTION_ID: '00000000-0000-0000-0000-000000000000',
            COST_OUTPUT_PATH: outputPath,
          },
          stdio: 'pipe',
        },
      )

      const payload = JSON.parse(readFileSync(outputPath, 'utf-8'))
      expect(payload.data_source).toBe('template_fallback')
      expect(payload.errors).toEqual([
        expect.stringMatching(/Azure CLI process launch failed.*ENOENT/),
      ])
    } finally {
      rmSync(workDir, { recursive: true, force: true })
    }
  })
})
