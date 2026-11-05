import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api/framework', () => ({
  withApi: (_config: unknown, handler: () => Promise<unknown>) => handler,
  ApiError: { notImplemented: (message: string) => Object.assign(new Error(message), { code: 'NOT_IMPLEMENTED' }) },
}))

import { createdByJobsOnly } from '../computed-resource'

const ANALYTICS = join(__dirname, '..', '..', '..', 'app', 'api', 'analytics')

function routes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? routes(join(dir, entry.name)) : entry.name === 'route.ts' ? [join(dir, entry.name)] : [],
  )
}

// DEF-0B2-ANALYTICS-CRUD-FACADE
describe('analytics rows are produced by jobs, never typed in', () => {
  it('a create answers 501 NOT_IMPLEMENTED and says why', async () => {
    const post = createdByJobsOnly('Create analytics metric (not implemented)', 'Analytics metrics') as unknown as () => Promise<unknown>
    await expect(post()).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED', message: expect.stringContaining('produced by the analytics jobs') })
  })

  it('no analytics route over the metric or trend tables exports the factory POST', () => {
    const offenders = routes(ANALYTICS).filter((file) => {
      const source = readFileSync(file, 'utf8')
      return /table: (analyticsMetrics|trendAnalyses),/.test(source) && /const \{[^}]*\bPOST\b[^}]*\} = crudRoutes/.test(source)
    })
    expect(offenders).toEqual([])
  })

  it('every one of those routes answers its create through the 501 helper and keeps its read', () => {
    const covered = routes(ANALYTICS).filter((file) => /table: (analyticsMetrics|trendAnalyses),/.test(readFileSync(file, 'utf8')))
    expect(covered.length).toBeGreaterThanOrEqual(29)
    for (const file of covered) {
      const source = readFileSync(file, 'utf8')
      expect(source, file).toContain('export const POST = createdByJobsOnly(')
      expect(source, file).toContain('const { GET } = crudRoutes(')
    }
  })
})
