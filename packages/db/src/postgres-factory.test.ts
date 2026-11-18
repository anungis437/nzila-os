import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ postgres: vi.fn(), drizzle: vi.fn() }))
vi.mock('postgres', () => ({ default: m.postgres }))
vi.mock('drizzle-orm/postgres-js', () => ({ drizzle: m.drizzle }))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('explicit typed Postgres infrastructure', () => {
  it('has no import-time pool and uses exactly the supplied URL, schema and options', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://unrelated-app.invalid/db')
    vi.stubEnv('PLATFORM_DATABASE_URL', 'postgres://unrelated-platform.invalid/db')
    const { createPostgresDatabase } = await import('./postgres-factory')
    expect(m.postgres).not.toHaveBeenCalled()
    const client = { client: true },
      database = { query: {} },
      schema = { table: {} }
    const options = { max: 5, idle_timeout: 20, connect_timeout: 10 }
    m.postgres.mockReturnValue(client)
    m.drizzle.mockReturnValue(database)
    expect(createPostgresDatabase('postgres://explicit.invalid/hq', schema, options)).toBe(database)
    expect(m.postgres).toHaveBeenCalledExactlyOnceWith('postgres://explicit.invalid/hq', options)
    expect(m.drizzle).toHaveBeenCalledExactlyOnceWith(client, { schema })
  })
  it.each(['', '   '])(
    'refuses an absent explicit URL %j before any driver fallback',
    async (url) => {
      const { createPostgresDatabase } = await import('./postgres-factory')
      expect(() => createPostgresDatabase(url, {}, {})).toThrow('explicit Postgres connection URL')
      expect(m.postgres).not.toHaveBeenCalled()
    },
  )
  it('propagates construction failure instead of selecting a different connection', async () => {
    const { createPostgresDatabase } = await import('./postgres-factory')
    m.postgres.mockImplementation(() => {
      throw new Error('connection refused')
    })
    expect(() => createPostgresDatabase('postgres://explicit.invalid/hq', {}, {})).toThrow(
      'connection refused',
    )
    expect(m.postgres).toHaveBeenCalledTimes(1)
    expect(m.drizzle).not.toHaveBeenCalled()
  })
})
