import { afterEach, describe, expect, it, vi } from 'vitest'

async function importClientWithMocks(options?: {
  databaseUrl?: string
  drizzleReturn?: Record<string, unknown>
}) {
  vi.resetModules()

  if (options?.databaseUrl) {
    process.env.DATABASE_URL = options.databaseUrl
  } else {
    process.env.DATABASE_URL = ''
  }

  const sqlClient = { tag: 'sql-client' }
  const drizzleReturn = options?.drizzleReturn ?? { select: vi.fn(), marker: 'db-instance' }
  const postgresMock = vi.fn(() => sqlClient)
  const drizzleMock = vi.fn(() => drizzleReturn)

  vi.doMock('postgres', () => ({ default: postgresMock }))
  vi.doMock('drizzle-orm/postgres-js', () => ({ drizzle: drizzleMock }))

  const clientModule = await import('../client')
  return { clientModule, postgresMock, drizzleMock, sqlClient, drizzleReturn }
}

afterEach(() => {
  vi.resetAllMocks()
  vi.resetModules()
  vi.doUnmock('postgres')
  vi.doUnmock('drizzle-orm/postgres-js')
  delete process.env.DATABASE_URL
})

describe.sequential('db client proxy', () => {
  it(
    'throws when DATABASE_URL is missing and the proxy is used',
    async () => {
      vi.resetModules()
      process.env.DATABASE_URL = ''
      const clientModule = await import('../client')

      expect(() => (clientModule.db as any).select).toThrow(
        'DATABASE_URL environment variable is required',
      )
    },
    60000,
  )

  it(
    'initializes the drizzle client once and reuses it for get/has access',
    async () => {
      const query = vi.fn()
      const { clientModule, postgresMock, drizzleMock } = await importClientWithMocks({
        databaseUrl: 'postgres://example.test/nzila',
        drizzleReturn: { query, marker: 'runtime-db' },
      })

      expect((clientModule.db as any).query).toBe(query)
      expect('marker' in (clientModule.db as any)).toBe(true)
      expect(postgresMock).toHaveBeenCalledTimes(1)
      expect(drizzleMock).toHaveBeenCalledTimes(1)
    },
    60000,
  )
})

describe.sequential('db runtime exports', () => {
  it('re-exports raw and platform database aliases', async () => {
    const { clientModule } = await importClientWithMocks({
      databaseUrl: 'postgres://example.test/nzila',
      drizzleReturn: { select: vi.fn() },
    })
    const rawModule = await import('../raw')
    const platformModule = await import('../platform')

    expect(rawModule.rawDb).toBe(clientModule.db)
    expect(platformModule.platformDb).toBe(clientModule.db)
  })

  it('loads the root barrel and schema barrels with known exports', async () => {
    await importClientWithMocks({
      databaseUrl: 'postgres://example.test/nzila',
      drizzleReturn: { select: vi.fn() },
    })

    const root = await import('../index')
    const schema = await import('../schema')
    const flow = await import('../schema/flow')
    const aiModels = await import('../schema/ai_models')

    expect(root.createScopedDb).toBeTypeOf('function')
    expect(root.withAudit).toBeTypeOf('function')
    expect(root.rawDb).toBe(root.db)
    expect(schema.flowPayments).toBeDefined()
    expect(schema.flowDomainEvents).toBeDefined()
    expect(flow.flowPayments).toBeDefined()
    expect(flow.flowDomainEvents).toBeDefined()
    expect(aiModels.aiModels).toBeDefined()
    expect(aiModels.aiDeployments).toBeDefined()
    expect(aiModels.aiDeploymentRoutes).toBeDefined()
  })

  it('exposes registry lists and set-based lookups', async () => {
    const registry = await import('../org-registry')

    expect(registry.ORG_SCOPED_TABLES).toContain('meetings')
    expect(registry.ORG_SCOPED_TABLE_SET.has('agriPayments')).toBe(true)
    expect(registry.NON_ORG_SCOPED_TABLES.find((entry) => entry.table === 'orgs')?.reason).toContain(
      'root table',
    )
    expect(registry.NON_ORG_SCOPED_TABLE_SET.has('partners')).toBe(true)
  })
})