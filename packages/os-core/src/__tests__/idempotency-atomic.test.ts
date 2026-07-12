/**
 * Atomic idempotency acquisition tests.
 *
 * These prove the CONCURRENCY guarantee that the older `check → mutate → set`
 * flow lacked: under simultaneous identical requests, exactly one mutation runs
 * and the others replay its result. Tests submit work with `Promise.all` so the
 * two flows genuinely interleave at their `await` points — none of them
 * serialize the requests internally.
 */
import { describe, expect, it, vi } from 'vitest'
import {
  IdempotencyConflictError,
  InMemoryIdempotencyCache,
  runIdempotentMutation,
} from '../idempotency'

function key(k = 'idempotency:org1:/api/x:key-1') {
  return k
}

describe('InMemoryIdempotencyCache.acquire — atomic first-writer election', () => {
  it('grants exactly one acquisition for the same key, others see in_progress', async () => {
    const cache = new InMemoryIdempotencyCache()
    const [a, b] = await Promise.all([
      cache.acquire(key(), 'hash'),
      cache.acquire(key(), 'hash'),
    ])
    const outcomes = [a.outcome, b.outcome].sort()
    expect(outcomes).toEqual(['acquired', 'in_progress'])
  })

  it('returns mismatch for a reservation completed with a different payload', async () => {
    const cache = new InMemoryIdempotencyCache()
    const acq = await cache.acquire(key(), 'hash-a')
    if (acq.outcome !== 'acquired') throw new Error('expected acquired')
    await cache.finalize(key(), acq.owner, {
      payloadHash: 'hash-a',
      status: 201,
      body: '{"id":"1"}',
      headers: {},
      createdAt: Date.now(),
    })
    const again = await cache.acquire(key(), 'hash-b')
    expect(again.outcome).toBe('mismatch')
  })

  it('replays a completed reservation for the same payload', async () => {
    const cache = new InMemoryIdempotencyCache()
    const acq = await cache.acquire(key(), 'hash')
    if (acq.outcome !== 'acquired') throw new Error('expected acquired')
    await cache.finalize(key(), acq.owner, {
      payloadHash: 'hash',
      status: 201,
      body: '{"id":"1"}',
      headers: {},
      createdAt: Date.now(),
    })
    const again = await cache.acquire(key(), 'hash')
    expect(again).toMatchObject({ outcome: 'replay' })
  })

  it('release drops a still-reserved key so a retry can re-acquire', async () => {
    const cache = new InMemoryIdempotencyCache()
    const acq = await cache.acquire(key(), 'hash')
    if (acq.outcome !== 'acquired') throw new Error('expected acquired')
    await cache.release(key(), acq.owner)
    expect((await cache.acquire(key(), 'hash')).outcome).toBe('acquired')
  })
})

describe('runIdempotentMutation — concurrent duplicate safety', () => {
  it('runs the mutation once for concurrent identical requests and replays the rest', async () => {
    const cache = new InMemoryIdempotencyCache()
    const run = vi.fn(async () => {
      // Simulate mutation latency so the second caller must wait for the first.
      await new Promise((r) => setTimeout(r, 15))
      return { id: 'source-1' }
    })

    const [r1, r2, r3] = await Promise.all([
      runIdempotentMutation({ cache, cacheKey: key(), payloadHash: 'h', status: 201, run, pollMs: 2 }),
      runIdempotentMutation({ cache, cacheKey: key(), payloadHash: 'h', status: 201, run, pollMs: 2 }),
      runIdempotentMutation({ cache, cacheKey: key(), payloadHash: 'h', status: 201, run, pollMs: 2 }),
    ])

    expect(run).toHaveBeenCalledTimes(1)
    expect(r1.response).toEqual({ id: 'source-1' })
    expect(r2.response).toEqual({ id: 'source-1' })
    expect(r3.response).toEqual({ id: 'source-1' })
    // Exactly one performed the mutation; the rest replayed.
    expect([r1, r2, r3].filter((r) => r.replayed)).toHaveLength(2)
  })

  it('raises a conflict for concurrent requests that share a key but differ in payload', async () => {
    const cache = new InMemoryIdempotencyCache()
    const run = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 15))
      return { id: 'source-1' }
    })

    const results = await Promise.allSettled([
      runIdempotentMutation({ cache, cacheKey: key(), payloadHash: 'hash-a', status: 201, run, pollMs: 2 }),
      runIdempotentMutation({ cache, cacheKey: key(), payloadHash: 'hash-b', status: 201, run, pollMs: 2 }),
    ])

    // At most one mutation runs; the incompatible payload is rejected as CONFLICT.
    expect(run).toHaveBeenCalledTimes(1)
    const rejected = results.filter((r) => r.status === 'rejected')
    expect(rejected).toHaveLength(1)
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(IdempotencyConflictError)
  })

  it('isolates the same idempotency key across different scopes (cache keys)', async () => {
    const cache = new InMemoryIdempotencyCache()
    let n = 0
    const run = vi.fn(async () => ({ id: `source-${++n}` }))

    const [a, b] = await Promise.all([
      runIdempotentMutation({ cache, cacheKey: 'idempotency:org1:/api/ws-A/x:key', payloadHash: 'h', status: 201, run }),
      runIdempotentMutation({ cache, cacheKey: 'idempotency:org1:/api/ws-B/x:key', payloadHash: 'h', status: 201, run }),
    ])

    // Independent scopes → two mutations, two distinct ids, neither replayed.
    expect(run).toHaveBeenCalledTimes(2)
    expect(a.response).not.toEqual(b.response)
    expect(a.replayed).toBe(false)
    expect(b.replayed).toBe(false)
  })

  it('releases the reservation on failure so a later retry succeeds (no cached failure)', async () => {
    const cache = new InMemoryIdempotencyCache()
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce({ id: 'source-1' })

    await expect(
      runIdempotentMutation({ cache, cacheKey: key(), payloadHash: 'h', status: 201, run }),
    ).rejects.toThrow('transient')

    const retry = await runIdempotentMutation({
      cache,
      cacheKey: key(),
      payloadHash: 'h',
      status: 201,
      run,
    })
    expect(retry.response).toEqual({ id: 'source-1' })
    expect(retry.replayed).toBe(false)
    expect(run).toHaveBeenCalledTimes(2)
  })
})
