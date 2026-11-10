/**
 * Distributed lock primitives — real Redis integration test.
 *
 * lib/services/__tests__/cache-service.test.ts proves these functions against an in-process ioredis mock; that is
 * sufficient for return-value/branch coverage but cannot prove actual distributed correctness (two independent
 * connections racing for the same key, a real TTL actually expiring, a real EXPIRE actually extending it). This file
 * runs the same acquireLock/extendLock/releaseLock/isLocked functions against a real Redis server.
 *
 * Opt-in by design: this suite only runs when UE_TEST_REDIS_URL is set to a reachable Redis instance. It is not wired
 * into any CI job in this change — run it locally against a throwaway container, e.g.:
 *   docker run --rm -d --name ue-test-redis -p 16379:6379 redis:7-alpine@sha256:c5d34a98396a4775e223c74e929162c35c5a2182901ba26b50ade939941ce14b
 *   UE_TEST_REDIS_URL=redis://127.0.0.1:16379 npx vitest run lib/services/__tests__/cache-service-lock.redis-integration.test.ts
 *   docker stop ue-test-redis
 * When the env var is unset (the default for every other local run and for any CI job that does not explicitly set
 * it), the whole suite is skipped — it never attempts a connection and never fails a run that has no Redis available.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

const REDIS_URL = process.env.UE_TEST_REDIS_URL

describe.skipIf(!REDIS_URL)('distributed lock primitives (real Redis)', () => {
  let acquireLock: typeof import('../cache-service').acquireLock
  let releaseLock: typeof import('../cache-service').releaseLock
  let extendLock: typeof import('../cache-service').extendLock
  let isLocked: typeof import('../cache-service').isLocked
  let initRedis: typeof import('../cache-service').initRedis
  let closeRedis: typeof import('../cache-service').closeRedis

  beforeAll(async () => {
    const mod = await import('../cache-service')
    ;({ acquireLock, releaseLock, extendLock, isLocked, initRedis, closeRedis } = mod)
    initRedis(REDIS_URL)
  })

  afterAll(async () => {
    await closeRedis()
  })

  afterEach(async () => {
    // Best-effort cleanup so one test's lock key never leaks into the next.
    const redis = new (await import('ioredis')).default(REDIS_URL)
    await redis.flushdb()
    await redis.quit()
  })

  it('only one of two concurrent acquirers wins the same lock name', async () => {
    const name = `lock-${Date.now()}-${Math.random()}`
    const [a, b] = await Promise.all([
      acquireLock(name, 30, 'itest'),
      acquireLock(name, 30, 'itest'),
    ])
    const tokens = [a, b].filter((t): t is string => t !== null)
    expect(tokens).toHaveLength(1)
    expect(await isLocked(name, 'itest')).toBe(true)
  })

  it('a real TTL actually expires the lock without any release', async () => {
    const name = `ttl-${Date.now()}-${Math.random()}`
    const token = await acquireLock(name, 1, 'itest')
    expect(token).not.toBeNull()
    expect(await isLocked(name, 'itest')).toBe(true)

    await new Promise((resolve) => setTimeout(resolve, 1500))

    expect(await isLocked(name, 'itest')).toBe(false)
    // Since the first token's lock expired, a second caller can now acquire the same name.
    const second = await acquireLock(name, 30, 'itest')
    expect(second).not.toBeNull()
  });

  it('extendLock actually pushes the real TTL forward, keeping the lock held past its original expiry', async () => {
    const name = `extend-${Date.now()}-${Math.random()}`
    const token = await acquireLock(name, 2, 'itest')
    expect(token).not.toBeNull()

    // Renew before the original 2s TTL would elapse.
    await new Promise((resolve) => setTimeout(resolve, 1000))
    const renewed = await extendLock(name, token as string, 30, 'itest')
    expect(renewed).toBe(true)

    // Past the ORIGINAL ttl's expiry point, the lock is still held because of the renewal.
    await new Promise((resolve) => setTimeout(resolve, 1500))
    expect(await isLocked(name, 'itest')).toBe(true);
  });

  it('extendLock refuses to renew with a stale or wrong token (token-bound, like release)', async () => {
    const name = `extend-wrong-token-${Date.now()}-${Math.random()}`
    const token = await acquireLock(name, 30, 'itest')
    expect(token).not.toBeNull()

    const renewedWithWrongToken = await extendLock(name, 'not-the-real-token', 30, 'itest')
    expect(renewedWithWrongToken).toBe(false)
    // The real holder's lock is untouched by the refused attempt.
    expect(await isLocked(name, 'itest')).toBe(true)
  })

  it('releaseLock only releases with the matching token, and isLocked reflects the real state throughout', async () => {
    const name = `release-${Date.now()}-${Math.random()}`
    const token = await acquireLock(name, 30, 'itest')
    expect(token).not.toBeNull()

    expect(await releaseLock(name, 'wrong-token', 'itest')).toBe(false)
    expect(await isLocked(name, 'itest')).toBe(true)

    expect(await releaseLock(name, token as string, 'itest')).toBe(true)
    expect(await isLocked(name, 'itest')).toBe(false)

    // A second release with the same (now stale) token is a safe no-op, not an error.
    expect(await releaseLock(name, token as string, 'itest')).toBe(false)
  })

  it('a renewed lock can still only be released by its original token, after the renewal', async () => {
    const name = `extend-then-release-${Date.now()}-${Math.random()}`
    const token = await acquireLock(name, 30, 'itest')
    expect(token).not.toBeNull()
    expect(await extendLock(name, token as string, 30, 'itest')).toBe(true)
    expect(await releaseLock(name, token as string, 'itest')).toBe(true)
    expect(await isLocked(name, 'itest')).toBe(false)
  })
})
