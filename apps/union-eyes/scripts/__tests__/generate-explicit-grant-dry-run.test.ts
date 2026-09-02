import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const APP_ROOT = resolve(__dirname, '..', '..')
const REPO_ROOT = resolve(APP_ROOT, '..', '..')
const REPORT_JSON = resolve(REPO_ROOT, 'reports', 'union-eyes-explicit-grant-dry-run.json')
const REPORT_MD = resolve(REPO_ROOT, 'reports', 'union-eyes-explicit-grant-dry-run.md')

describe('generate-explicit-grant-dry-run', () => {
  it('runs without throwing and produces an internally consistent plan', () => {
    execFileSync('npx', ['tsx', 'scripts/generate-explicit-grant-dry-run.ts'], {
      cwd: APP_ROOT,
      stdio: 'pipe',
    })

    expect(existsSync(REPORT_JSON)).toBe(true)
    expect(existsSync(REPORT_MD)).toBe(true)

    const report = JSON.parse(readFileSync(REPORT_JSON, 'utf8'))
    expect(report.readyForExplicitGrantCount).toBeGreaterThan(0)
    expect(report.readyForExplicitGrantCount + report.pendingReviewCount).toBe(report.totalManifestEntries)
    // Every ready entry must have fully resolved (non-TBD, array) privileges —
    // the generator itself throws before writing the report if this is
    // violated, so a successful run already proves this, but assert it
    // explicitly too so a future refactor can't silently swallow the throw.
    for (const row of report.readyForExplicitGrant) {
      expect(Array.isArray(row.tenantPrivileges)).toBe(true)
      expect(Array.isArray(row.systemPrivileges)).toBe(true)
      if (row.classification === 'SYSTEM_ONLY') {
        expect(row.tenantPrivileges).toEqual([])
      }
      if (row.classification === 'LATENT_UNREACHABLE') {
        expect(row.tenantPrivileges).toEqual([])
        expect(row.systemPrivileges).toEqual([])
      }
    }

    const md = readFileSync(REPORT_MD, 'utf8')
    expect(md).toContain('Explicit Grant Dry-Run Plan')
  })
})
