import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')

function read(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf8')
}

describe('Zonga dashboard KPI hardening contract', () => {
  it('exposes a centralized KPI service with provenance and cache metadata', () => {
    const source = read('apps/zonga/lib/services/dashboard-kpi-service.ts')

    expect(source).toContain('getZongaOperationsDashboard')
    expect(source).toContain('DashboardProvenance')
    expect(source).toContain('provenance')
    expect(source).toContain('window')
    expect(source).toContain('sources')
    expect(source).toContain('cache')
    expect(source).toContain('cacheGet')
    expect(source).toContain('cacheSet')
  })

  it('routes the operations admin page through the shared KPI service', () => {
    const source = read('apps/zonga/app/[locale]/dashboard/operations/page.tsx')

    expect(source).toContain('getZongaOperationsDashboard')
    // Must not bypass the KPI service by calling the raw observability fetcher
    expect(source).not.toContain('getAdminDashboard(orgId)')
  })

  it('exposes the operations KPI payload via a guarded API route', () => {
    const source = read('apps/zonga/app/api/dashboard/operations/route.ts')

    expect(source).toContain('withOrgScope')
    expect(source).toContain('getZongaOperationsDashboard')
    expect(source).toMatch(/data:\s*data|standardSuccessResponse|NextResponse\.json/)
  })

  it('cache layer is pluggable and falls back gracefully when Redis is absent', () => {
    const source = read('apps/zonga/lib/services/cache-service.ts')

    expect(source).toContain('cacheGet')
    expect(source).toContain('cacheSet')
    // In-memory fallback so dashboards keep working without Redis
    expect(source).toMatch(/memoryStore|memoryCache|fallback/i)
    expect(source).toContain('REDIS_URL')
  })
})
