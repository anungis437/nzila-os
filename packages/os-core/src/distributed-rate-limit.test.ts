import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkDistributedRateLimit } from './distributed-rate-limit'

describe('checkDistributedRateLimit', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('uses one atomic Redis EVAL and permits requests within the limit', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: [3, 120] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(checkDistributedRateLimit({
      url: 'https://redis.example.test', token: 'secret', key: 'sage:claim:hash', limit: 3, windowSeconds: 300,
    })).resolves.toEqual({ allowed: true })

    expect(fetchMock).toHaveBeenCalledWith('https://redis.example.test', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('EVAL'),
    }))
  })

  it('denies over-limit requests with the Redis TTL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result: [4, 42] }) }))

    await expect(checkDistributedRateLimit({
      url: 'https://redis.example.test', token: 'secret', key: 'sage:claim:hash', limit: 3, windowSeconds: 300,
    })).resolves.toEqual({ allowed: false, retryAfterSeconds: 42 })
  })

  it('fails closed when Redis is unavailable or responds with an invalid result', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network unavailable')))
    const input = { url: 'https://redis.example.test', token: 'secret', key: 'sage:claim:hash', limit: 3, windowSeconds: 300 }
    await expect(checkDistributedRateLimit(input)).resolves.toEqual({ allowed: false })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result: ['4', 42] }) }))
    await expect(checkDistributedRateLimit(input)).resolves.toEqual({ allowed: false })
  })
})
