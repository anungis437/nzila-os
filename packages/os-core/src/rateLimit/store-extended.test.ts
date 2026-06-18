/**
 * Extended tests for rateLimit/store.ts — cover RedisRateLimitStore + factory
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { RedisLike } from './store'

describe('RedisRateLimitStore', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  async function loadStore() {
    return import('./store') as Promise<typeof import('./store')>
  }

  it('allows request under limit and records hit', async () => {
    const execResults = [
      [null, 0], // zremrangebyscore result
      [null, 3], // zcard — 3 current hits (under max 10)
    ] as [Error | null, unknown][]

    const execAdd = [
      [null, 1], // zadd
      [null, 1], // pexpire
    ] as [Error | null, unknown][]

    const mockMulti = () => ({
      zremrangebyscore: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      pexpire: vi.fn().mockReturnThis(),
      exec: vi.fn()
        .mockResolvedValueOnce(execResults)
        .mockResolvedValueOnce(execAdd),
    })

    const mockRedis = {
      multi: mockMulti,
      del: vi.fn().mockResolvedValue(1),
      ping: vi.fn().mockResolvedValue('PONG'),
    }

    const { RedisRateLimitStore } = await loadStore()
    const store = new RedisRateLimitStore(mockRedis as unknown as RedisLike)

    const result = await store.hit('key:1', 60_000, 10)
    expect(result.allowed).toBe(true)
    expect(result.count).toBe(4) // 3 + 1
    expect(result.remaining).toBe(6) // 10 - 4
  })

  it('denies request at limit', async () => {
    const execResults = [
      [null, 0],  // zremrangebyscore
      [null, 10], // zcard — already at max
    ] as [Error | null, unknown][]

    const mockMulti = () => ({
      zremrangebyscore: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValueOnce(execResults),
    })

    const mockRedis = {
      multi: mockMulti,
      del: vi.fn(),
      ping: vi.fn(),
    }

    const { RedisRateLimitStore } = await loadStore()
    const store = new RedisRateLimitStore(mockRedis as unknown as RedisLike)

    const result = await store.hit('key:1', 60_000, 10)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.count).toBe(10)
  })

  it('reset deletes the key with prefix', async () => {
    const mockRedis = {
      multi: vi.fn(),
      del: vi.fn().mockResolvedValue(1),
      ping: vi.fn(),
    }

    const { RedisRateLimitStore } = await loadStore()
    const store = new RedisRateLimitStore(mockRedis as RedisLike, { keyPrefix: 'test:rl:' })

    await store.reset('mykey')
    expect(mockRedis.del).toHaveBeenCalledWith('test:rl:mykey')
  })

  it('peek returns current count without adding hit', async () => {
    const execResults = [
      [null, 0],  // zremrangebyscore
      [null, 5],  // zcard
    ] as [Error | null, unknown][]

    const mockMulti = () => ({
      zremrangebyscore: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValueOnce(execResults),
    })

    const mockRedis = {
      multi: mockMulti,
      del: vi.fn(),
      ping: vi.fn(),
    }

    const { RedisRateLimitStore } = await loadStore()
    const store = new RedisRateLimitStore(mockRedis as unknown as RedisLike)

    const count = await store.peek('key:1', 60_000)
    expect(count).toBe(5)
  })

  it('healthy returns true on PONG', async () => {
    const mockRedis = {
      multi: vi.fn(),
      del: vi.fn(),
      ping: vi.fn().mockResolvedValue('PONG'),
    }

    const { RedisRateLimitStore } = await loadStore()
    const store = new RedisRateLimitStore(mockRedis as RedisLike)

    expect(await store.healthy()).toBe(true)
  })

  it('healthy returns false on ping failure', async () => {
    const mockRedis = {
      multi: vi.fn(),
      del: vi.fn(),
      ping: vi.fn().mockRejectedValue(new Error('connection refused')),
    }

    const { RedisRateLimitStore } = await loadStore()
    const store = new RedisRateLimitStore(mockRedis as RedisLike)

    expect(await store.healthy()).toBe(false)
  })

  it('uses default key prefix nzila:rl:', async () => {
    const mockDel = vi.fn().mockResolvedValue(1)
    const mockRedis = {
      multi: vi.fn(),
      del: mockDel,
      ping: vi.fn(),
    }

    const { RedisRateLimitStore } = await loadStore()
    const store = new RedisRateLimitStore(mockRedis as RedisLike)

    await store.reset('test')
    expect(mockDel).toHaveBeenCalledWith('nzila:rl:test')
  })
})

describe('InMemoryRateLimitStore (extended)', () => {
  async function loadStore() {
    return import('./store') as Promise<typeof import('./store')>
  }

  it('peek returns count without recording a hit', async () => {
    const { InMemoryRateLimitStore } = await loadStore()
    const store = new InMemoryRateLimitStore()

    await store.hit('key:1', 60_000, 10)
    await store.hit('key:1', 60_000, 10)

    const count = await store.peek('key:1', 60_000)
    expect(count).toBe(2)
  })

  it('reset clears a key', async () => {
    const { InMemoryRateLimitStore } = await loadStore()
    const store = new InMemoryRateLimitStore()

    await store.hit('key:1', 60_000, 10)
    await store.reset('key:1')
    const count = await store.peek('key:1', 60_000)
    expect(count).toBe(0)
  })

  it('healthy always returns true', async () => {
    const { InMemoryRateLimitStore } = await loadStore()
    const store = new InMemoryRateLimitStore()
    expect(await store.healthy()).toBe(true)
  })
})

describe('getRateLimitStore', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('returns InMemoryRateLimitStore by default', async () => {
    delete process.env.RATE_LIMIT_STORE
    const { getRateLimitStore, InMemoryRateLimitStore } = await loadStore()
    const store = await getRateLimitStore()
    expect(store).toBeInstanceOf(InMemoryRateLimitStore)
  })

  it('returns InMemoryRateLimitStore when RATE_LIMIT_STORE=redis but no REDIS_URL', async () => {
    process.env.RATE_LIMIT_STORE = 'redis'
    delete process.env.REDIS_URL

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { getRateLimitStore, InMemoryRateLimitStore } = await loadStore()
    const store = await getRateLimitStore()

    expect(store).toBeInstanceOf(InMemoryRateLimitStore)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('REDIS_URL not set'))
    warnSpy.mockRestore()
  })

  it('returns RedisRateLimitStore when redis client is provided via DI', async () => {
    process.env.RATE_LIMIT_STORE = 'redis'

    const mockRedis = {
      multi: vi.fn(),
      del: vi.fn(),
      ping: vi.fn().mockResolvedValue('PONG'),
    }

    const { getRateLimitStore, RedisRateLimitStore } = await loadStore()
    const store = await getRateLimitStore(mockRedis as RedisLike)
    expect(store).toBeInstanceOf(RedisRateLimitStore)
  })

  it('caches the singleton on second call', async () => {
    delete process.env.RATE_LIMIT_STORE
    const { getRateLimitStore } = await loadStore()
    const first = await getRateLimitStore()
    const second = await getRateLimitStore()
    expect(first).toBe(second)
  })

  async function loadStore() {
    return import('./store') as Promise<typeof import('./store')>
  }
})
