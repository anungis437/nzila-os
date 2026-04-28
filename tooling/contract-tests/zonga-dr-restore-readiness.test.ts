import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')

function read(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf8')
}

describe('Zonga DR restore readiness contract', () => {
  it('keeps required DR drill scripts wired in workspace package scripts', () => {
    const packageJson = read('package.json')

    expect(packageJson).toContain('"db:restore-drill"')
    expect(packageJson).toContain('"db:restore-drill:execute"')
    expect(packageJson).toContain('"dr:drill:checklist"')
    expect(packageJson).toContain('"dr:drill:report"')
  })

  it('keeps the shared restore drill script auditable for Zonga', () => {
    const source = read('scripts/db/restore-drill.ts')

    expect(source).toContain('--execute')
    expect(source).toContain('rtoActual')
    expect(source).toContain('db-doctor')
    expect(source).toContain('migration-safety')
    expect(source).toContain('DR_DB_HOST')
    expect(source).toContain('DR_READY_URL')
  })

  it('publishes a Zonga-specific DR runbook aligned with live drill execution', () => {
    const runbook = read('docs/zonga/dr/restore-drill-runbook.md')

    expect(runbook).toContain('Zonga')
    expect(runbook).toContain('pnpm dr:drill:checklist --live')
    expect(runbook).toContain('pnpm db:restore-drill:execute')
    expect(runbook).toContain('reports/dr/restore-drill-YYYY-MM-DD.md')
    expect(runbook).toContain('zonga_drill_')
    // RTO / RPO targets must be explicit so claims are measurable
    expect(runbook).toMatch(/RTO[\s\S]*4 hours/)
    expect(runbook).toMatch(/RPO[\s\S]*1 hour/)
  })

  it('keeps Zonga enrolled in the SRE service-tier matrix used by gameday scenarios', () => {
    const tiers = read('governance/sre/service-tiers.json')

    expect(tiers).toMatch(/"zonga"|"@nzila\/zonga"|nzila-os-zonga/)
  })
})
