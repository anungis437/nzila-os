/**
 * Tests for idempotency.ts — getGlobalIdempotencyCache,
 * cleanupExpiredIdempotencyEntries, and edge helpers not previously covered.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('getGlobalIdempotencyCache', () => {
  beforeEach(() => {
    vi.resetModules()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.NZILA_ENV
    delete process.env.DATABASE_URL
  })

  it('returns InMemoryIdempotencyCache in non-strict (dev) env', async () => {
    process.env.NZILA_ENV = 'dev'
    const { getGlobalIdempotencyCache, InMemoryIdempotencyCache } =
      await import('../idempotency')
    const cache = getGlobalIdempotencyCache()
    expect(cache).toBeInstanceOf(InMemoryIdempotencyCache)
  })

  it('returns InMemoryIdempotencyCache when strict but no DATABASE_URL', async () => {
    process.env.NZILA_ENV = 'prod'
    delete process.env.DATABASE_URL
    const { getGlobalIdempotencyCache, InMemoryIdempotencyCache } =
      await import('../idempotency')
    const cache = getGlobalIdempotencyCache()
    expect(cache).toBeInstanceOf(InMemoryIdempotencyCache)
  })

  it('returns PostgresIdempotencyCache in strict env with DATABASE_URL', async () => {
    process.env.NZILA_ENV = 'prod'
    process.env.DATABASE_URL = 'postgres://localhost/test'
    // Mock the @nzila/db modules so PostgresIdempotencyCache can be constructed
    vi.doMock('@nzila/db/client', () => ({
      db: {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        onConflictDoUpdate: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
      },
    }))
    vi.doMock('@nzila/db/schema', () => ({
      idempotencyCache: {
        id: 'id',
        cacheKey: 'cacheKey',
        payloadHash: 'payloadHash',
        expiresAt: 'expiresAt',
      },
    }))
    vi.doMock('drizzle-orm', () => ({
      eq: vi.fn(),
      lt: vi.fn(),
      sql: vi.fn(),
    }))

    const { getGlobalIdempotencyCache, InMemoryIdempotencyCache } =
      await import('../idempotency')
    const cache = getGlobalIdempotencyCache()
    // Should NOT be InMemoryIdempotencyCache
    expect(cache).not.toBeInstanceOf(InMemoryIdempotencyCache)
    expect(cache).toBeDefined()
    expect(typeof cache.get).toBe('function')
    expect(typeof cache.set).toBe('function')
  })

  it('returns singleton on repeated calls', async () => {
    process.env.NZILA_ENV = 'dev'
    const { getGlobalIdempotencyCache } = await import('../idempotency')
    const a = getGlobalIdempotencyCache()
    const b = getGlobalIdempotencyCache()
    expect(a).toBe(b)
  })
})

describe('cleanupExpiredIdempotencyEntries', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('deletes expired rows and returns count', async () => {
    const mockReturning = vi.fn().mockResolvedValue([{ id: '1' }, { id: '2' }])
    const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning })
    const mockDelete = vi.fn().mockReturnValue({ where: mockWhere })

    vi.doMock('@nzila/db/client', () => ({
      db: { delete: mockDelete },
    }))
    vi.doMock('@nzila/db/schema', () => ({
      idempotencyCache: { id: 'id', expiresAt: 'expiresAt' },
    }))
    vi.doMock('drizzle-orm', () => ({
      lt: vi.fn((...args: unknown[]) => ({ op: 'lt', args })),
      sql: vi.fn(),
    }))

    const { cleanupExpiredIdempotencyEntries } = await import('../idempotency')
    const count = await cleanupExpiredIdempotencyEntries()
    expect(count).toBe(2)
    expect(mockDelete).toHaveBeenCalled()
  })

  it('returns 0 when no expired entries', async () => {
    const mockReturning = vi.fn().mockResolvedValue([])
    const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning })
    const mockDelete = vi.fn().mockReturnValue({ where: mockWhere })

    vi.doMock('@nzila/db/client', () => ({
      db: { delete: mockDelete },
    }))
    vi.doMock('@nzila/db/schema', () => ({
      idempotencyCache: { id: 'id', expiresAt: 'expiresAt' },
    }))
    vi.doMock('drizzle-orm', () => ({
      lt: vi.fn(),
      sql: vi.fn(),
    }))

    const { cleanupExpiredIdempotencyEntries } = await import('../idempotency')
    const count = await cleanupExpiredIdempotencyEntries()
    expect(count).toBe(0)
  })
})
