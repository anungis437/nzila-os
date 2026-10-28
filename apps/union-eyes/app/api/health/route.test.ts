import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@nzila/db', () => ({ db: { execute: vi.fn(async () => []) } }))
vi.mock('@nzila/os-core/telemetry', () => ({ createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }))

const KEYS = ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'REDIS_URL'] as const
const saved: Record<string, string | undefined> = {}

describe('health route: Redis semantics', () => {
  beforeEach(() => {
    for (const key of KEYS) {
      saved[key] = process.env[key]
      delete process.env[key]
    }
    vi.resetModules()
  })
  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  })

  const redisCheck = async () => {
    const { GET } = await import('./route')
    const response = await GET()
    return ((await response.json()) as { checks: { redis: { status: string; note?: string } } }).checks.redis
  }

  it('reports a missing Redis as degraded, because rate limiting is a security control', async () => {
    const redis = await redisCheck()
    expect(redis.status).toBe('degraded')
    expect(redis.note).toMatch(/rate limiting is degraded/i)
    expect(redis.note).not.toMatch(/optional/i)
  })

  it('reports an unreachable Redis as degraded without hanging the probe', async () => {
    process.env.REDIS_URL = 'redis://127.0.0.1:1'
    const started = Date.now()
    const redis = await redisCheck()
    expect(redis.status).toBe('degraded')
    expect(redis.note).toMatch(/unreachable/i)
    expect(Date.now() - started).toBeLessThan(5_000)
  })
})
