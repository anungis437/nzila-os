/**
 * R-54: public marketing case studies must never expose unpublished, scheduled
 * or authenticated-only content. The physical table has visibility/published_at
 * but NO status column; the old public query returned all records by default.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PgDialect, type PgTable } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

const m = vi.hoisted(() => ({
  publicHandler: undefined as undefined | ((ctx: { request: Request }) => Promise<unknown>),
  queryPredicates: [] as unknown[],
  factoryOptions: [] as Array<{ readRole?: string; writeRole?: string }>,
}))
vi.mock('@/db/schema', async () => {
  const { pgTable, text, timestamp } = await import('drizzle-orm/pg-core')
  return {
    caseStudies: pgTable('case_studies', {
      id: text('id').primaryKey(),
      slug: text('slug'),
      visibility: text('visibility'),
      publishedAt: timestamp('published_at'),
      createdAt: timestamp('created_at'),
    }) as PgTable,
  }
})
vi.mock('@/lib/api/crud-factory', () => ({
  crudRoutes: (opts: { readRole?: string; writeRole?: string }) => {
    m.factoryOptions.push(opts)
    return { POST: vi.fn(), GET: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() }
  },
}))
vi.mock('@/lib/api/with-api', () => ({
  withApi: (_opts: unknown, handler: (ctx: { request: Request }) => Promise<unknown>) => {
    m.publicHandler = handler
    return handler
  },
}))
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: (run: () => unknown) => run() }))
vi.mock('@/db/db', () => ({
  db: {
    select: () => {
      const chain: Record<string, unknown> = {}
      chain.from = () => chain
      chain.where = (condition: unknown) => { m.queryPredicates.push(condition); return chain }
      chain.orderBy = () => chain
      chain.limit = () => chain
      chain.offset = async () => []
      chain.then = (resolve: (v: Array<{ total: number }>) => unknown) => resolve([{ total: 0 }])
      return chain
    },
  },
}))
const render = (value: unknown) => new PgDialect().sqlToQuery(value as SQL)
const publicHandler = () => {
  if (!m.publicHandler) throw new Error('public case-studies handler not mounted')
  return m.publicHandler
}
const request = (query = '') => ({ request: new Request(`http://localhost/api/case-studies${query}`) })

describe('R-54 public case-studies publication boundary', () => {
  beforeEach(() => {
    vi.resetModules()
    m.publicHandler = undefined
    m.queryPredicates.length = 0
    m.factoryOptions.length = 0
  })

  it('filters BOTH public list and count by visibility and real publication date', async () => {
    await import('../route')
    await publicHandler()(request())
    expect(m.queryPredicates).toHaveLength(2)
    for (const condition of m.queryPredicates) {
      const query = render(condition)
      expect(query.sql).toContain('"case_studies"."visibility"')
      expect(query.sql).toContain('"case_studies"."published_at"')
      expect(query.sql).toMatch(/<=? \$\d+/)
      expect(query.params).toContain('public')
      expect(query.params.some((x) => x instanceof Date || (typeof x === 'string' && /^\\d{4}-\\d{2}-\\d{2}/.test(x)))).toBe(true)
    }
  })

  it('rejects a request that tries to select unpublished draft content through the obsolete status argument', async () => {
    await import('../route')
    await expect(publicHandler()(request('?status=draft'))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    expect(m.queryPredicates).toHaveLength(0)
  })

  it('even ?status=published keeps the same server-enforced privacy predicates', async () => {
    await import('../route')
    await publicHandler()(request('?status=published'))
    expect(m.queryPredicates).toHaveLength(2)
    for (const condition of m.queryPredicates) expect(render(condition).params).toContain('public')
  })

  it('platform content role, not an organizational administrator, is required to create global marketing records', async () => {
    await import('../route')
    expect(m.factoryOptions[0]?.writeRole).toBe('content_manager')
  })

  it('global item routes require the platform content role for both reads and writes', async () => {
    await import('../[slug]/route')
    expect(m.factoryOptions[0]).toMatchObject({ readRole: 'content_manager', writeRole: 'content_manager' })
  })
})
