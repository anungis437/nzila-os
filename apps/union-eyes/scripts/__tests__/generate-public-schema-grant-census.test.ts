import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const APP_ROOT = resolve(__dirname, '..', '..')
const REPO_ROOT = resolve(APP_ROOT, '..', '..')
const REPORT_JSON = resolve(REPO_ROOT, 'reports', 'union-eyes-public-schema-grant-census.json')
const REPORT_MD = resolve(REPO_ROOT, 'reports', 'union-eyes-public-schema-grant-census.md')

describe('generate-public-schema-grant-census', () => {
  it('runs and produces a valid report; every canonical public-schema table has an authority entry', () => {
    execFileSync('npx', ['tsx', 'scripts/generate-public-schema-grant-census.ts'], {
      cwd: APP_ROOT,
      stdio: 'pipe',
    })

    expect(existsSync(REPORT_JSON)).toBe(true)
    expect(existsSync(REPORT_MD)).toBe(true)

    const report = JSON.parse(readFileSync(REPORT_JSON, 'utf8'))
    expect(report.publicSchemaTableCount).toBeGreaterThan(0)
    expect(report.publicSchemaTableCount).toBe(report.publicTablesWithAuthorityEntry)
    // PERMANENT INVARIANT (PR #752 round 7): every canonical public-schema
    // table must have exactly one authority-manifest entry — "no entry at
    // all" is not a valid disposition for a table that could receive a
    // union_eyes_runtime/union_eyes_system grant.
    expect(report.publicTablesWithoutAuthorityEntry).toBe(0)
    expect(report.publicTablesWithoutAuthorityEntryList).toEqual([])

    const md = readFileSync(REPORT_MD, 'utf8')
    expect(md).toContain('Public-Schema Grant-Scope Census')
  })
})
