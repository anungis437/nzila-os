import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ create: vi.fn() }))
vi.mock('@nzila/db/postgres-factory', () => ({ createPostgresDatabase: m.create }))
vi.mock('server-only', () => ({}))
beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.stubEnv('DATABASE_URL', '')
  vi.stubEnv('NZILA_HQ_DB_POOL_MAX', undefined)
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('HQ optional lazy database wrapper', () => {
  it('does not use a platform URL when the HQ database is absent', async () => {
    vi.stubEnv('PLATFORM_DATABASE_URL', 'postgres://platform.invalid/database')
    const { getHqDb, isDbAvailable } = await import('./client')
    expect(m.create).not.toHaveBeenCalled()
    expect(isDbAvailable()).toBe(false)
    expect(getHqDb()).toBeNull()
    expect(m.create).not.toHaveBeenCalled()
  })
  it('uses the exact HQ schema/options lazily and reuses the single instance', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://hq.invalid/database')
    vi.stubEnv('PLATFORM_DATABASE_URL', 'postgres://platform.invalid/database')
    const { getHqDb, isDbAvailable, schema } = await import('./client')
    const database = { query: {} }
    m.create.mockReturnValue(database)
    expect(m.create).not.toHaveBeenCalled()
    expect(isDbAvailable()).toBe(true)
    expect(getHqDb()).toBe(database)
    expect(getHqDb()).toBe(database)
    expect(m.create).toHaveBeenCalledExactlyOnceWith('postgres://hq.invalid/database', schema, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
      onnotice: expect.any(Function),
    })
    vi.stubEnv('DATABASE_URL', '')
    expect(getHqDb()).toBe(database)
  })
  it('preserves a configured pool bound', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://hq.invalid/database')
    vi.stubEnv('NZILA_HQ_DB_POOL_MAX', '2')
    const { getHqDb } = await import('./client')
    getHqDb()
    expect(m.create).toHaveBeenCalledWith(
      'postgres://hq.invalid/database',
      expect.any(Object),
      expect.objectContaining({ max: 2 }),
    )
  })
})
