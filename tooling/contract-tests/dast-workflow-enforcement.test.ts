import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const DAST_WORKFLOW = join(ROOT, '.github', 'workflows', 'dast.yml')
const ZAP_RULES = join(ROOT, '.zap', 'rules.tsv')

function readContent(filePath: string): string {
  return readFileSync(filePath, 'utf-8')
}

describe('DAST workflow enforcement', () => {
  it('defines a dedicated DAST workflow and ZAP rules file', () => {
    expect(existsSync(DAST_WORKFLOW)).toBe(true)
    expect(existsSync(ZAP_RULES)).toBe(true)
  })

  it('runs weekly and supports manual dispatch', () => {
    const source = readContent(DAST_WORKFLOW)

    expect(source).toContain("name: DAST Security Scan")
    expect(source).toContain("cron: '0 3 * * 1'")
    expect(source).toContain('workflow_dispatch:')
  })

  it('covers the four staging targets with ZAP baseline scans', () => {
    const source = readContent(DAST_WORKFLOW)

    expect(source).toContain('uses: zaproxy/action-baseline@v0.14.0')
    expect(source).toContain("- name: web")
    expect(source).toContain("- name: console")
    expect(source).toContain("- name: union-eyes")
    expect(source).toContain("- name: zonga")
    expect(source).toContain("rules_file_name: '.zap/rules.tsv'")
  })

  it('runs an API scan and retains reports as evidence', () => {
    const source = readContent(DAST_WORKFLOW)

    expect(source).toContain('uses: zaproxy/action-api-scan@v0.9.0')
    expect(source).toContain('name: zap-api-report-${{ github.run_id }}')
    expect(source).toContain('name: dast-evidence-${{ github.run_id }}')
    expect(source).toContain('retention-days: 365')
    expect(source).toContain('artifacts/dast/dast-evidence.json')
  })
})