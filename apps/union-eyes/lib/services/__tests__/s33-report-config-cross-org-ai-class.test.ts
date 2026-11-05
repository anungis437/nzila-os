import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

describe('Gate 0 batch B89: stored report contract, cross-organization read, AI data class', () => {
  it('applies the executor contract when a report definition is created or updated', () => {
    expect(src('app/api/reports/route.ts')).toContain('beforeCreate:')
    expect(src('app/api/reports/route.ts')).toContain('validateStoredReportConfig(values.config)')
    expect(src('app/api/reports/[id]/route.ts')).toContain('beforeUpdate:')
    expect(src('app/api/reports/[id]/route.ts')).toContain('validateStoredReportConfig(updates.config)')
    expect(src('app/api/reports/execute/route.ts')).toContain("from '@/lib/reports/report-config-validation'")
  })

  it('reads and audits the cross-organization aggregate under the system role', () => {
    const route = src('app/api/analytics/cross-org/route.ts')
    expect(route).toContain('withSystemContext(async (tx)')
    expect(route).not.toMatch(/await db\b/)
    expect(route.indexOf('.limit(1000)')).toBeLessThan(route.indexOf("action: 'analytics.cross_org.read'"))
    const manifest = src('db/rls-storage-authority/analytics-ai.ts')
    const entry = manifest.slice(manifest.indexOf('table: "analytics_metrics"'), manifest.indexOf('table: "analytics_scheduled_reports"'))
    expect(entry).toContain('requiredSystemPrivileges: ["SELECT"]')
  })

  it('declares claim text sent for precedent analysis as regulated', () => {
    const service = src('lib/services/ai/precedent-matching-service.ts')
    expect(service.match(/dataClass: 'regulated'/g)?.length).toBe(4)
    expect(service).not.toContain("dataClass: 'internal'")
  })
})
