/**
 * Cache Service — Unit Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const redisMocks = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockSetex: vi.fn(),
  mockDel: vi.fn(),
  mockQuit: vi.fn(),
  mockOn: vi.fn(),
  mockKeys: vi.fn(),
  mockTtl: vi.fn(),
  mockExists: vi.fn(),
  mockIncr: vi.fn(),
  mockExpire: vi.fn(),
  mockSet: vi.fn(),
  mockEval: vi.fn(),
  mockInfo: vi.fn(),
  mockDbsize: vi.fn(),
  mockPing: vi.fn(),
  mockZremrangebyscore: vi.fn(),
  mockZcard: vi.fn(),
  mockZadd: vi.fn(),
  mockZrange: vi.fn(),
}));

vi.mock('ioredis', () => {
  function MockRedis() {
    return {
      get: redisMocks.mockGet,
      setex: redisMocks.mockSetex,
      del: redisMocks.mockDel,
      quit: redisMocks.mockQuit,
      on: redisMocks.mockOn,
      keys: redisMocks.mockKeys,
      ttl: redisMocks.mockTtl,
      exists: redisMocks.mockExists,
      incr: redisMocks.mockIncr,
      expire: redisMocks.mockExpire,
      set: redisMocks.mockSet,
      eval: redisMocks.mockEval,
      info: redisMocks.mockInfo,
      dbsize: redisMocks.mockDbsize,
      ping: redisMocks.mockPing,
      zremrangebyscore: redisMocks.mockZremrangebyscore,
      zcard: redisMocks.mockZcard,
      zadd: redisMocks.mockZadd,
      zrange: redisMocks.mockZrange,
    };
  }
  return { default: MockRedis };
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('cache-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisMocks.mockGet.mockResolvedValue(null);
    redisMocks.mockSetex.mockResolvedValue('OK');
    redisMocks.mockDel.mockResolvedValue(1);
    redisMocks.mockQuit.mockResolvedValue('OK');
    redisMocks.mockTtl.mockResolvedValue(200);
    redisMocks.mockExists.mockResolvedValue(1);
    redisMocks.mockIncr.mockResolvedValue(1);
    redisMocks.mockExpire.mockResolvedValue(1);
    redisMocks.mockKeys.mockResolvedValue([]);
    redisMocks.mockInfo.mockResolvedValue('used_memory:1024');
    redisMocks.mockDbsize.mockResolvedValue(10);
    redisMocks.mockPing.mockResolvedValue('PONG');
    redisMocks.mockZremrangebyscore.mockResolvedValue(0);
    redisMocks.mockZcard.mockResolvedValue(0);
    redisMocks.mockZadd.mockResolvedValue(1);
    redisMocks.mockZrange.mockResolvedValue([]);
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── init / singleton / close ──────────────────────────────────────────
  it('initRedis creates Redis instance', async () => {
    const { initRedis } = await import('../cache-service');
    const redis = initRedis('redis://localhost:6379');
    expect(redis).toBeDefined();
    expect(redisMocks.mockOn).toHaveBeenCalled();
  });

  it('initRedis registers event handlers that are callable', async () => {
    const { initRedis } = await import('../cache-service');
    initRedis('redis://localhost:6379');

    const onCalls = redisMocks.mockOn.mock.calls;
    const handlers = new Map(onCalls.map(([event, handler]) => [event as string, handler as (...args: unknown[]) => void]));

    handlers.get('error')?.(new Error('boom'));
    handlers.get('connect')?.();
    handlers.get('ready')?.();
    handlers.get('close')?.();

    expect(onCalls.map(([event]) => event)).toEqual(expect.arrayContaining(['error', 'connect', 'ready', 'close']));
  });

  it('getRedis returns singleton (lazy init)', async () => {
    const { getRedis } = await import('../cache-service');
    const r1 = getRedis();
    const r2 = getRedis();
    expect(r1).toBe(r2);
  });

  it('closeRedis cleans up and nullifies client', async () => {
    const { initRedis, closeRedis, getRedis } = await import('../cache-service');
    initRedis();
    await closeRedis();
    // After closing, getRedis should create a new instance
    const newClient = getRedis();
    expect(newClient).toBeDefined();
    expect(redisMocks.mockQuit).toHaveBeenCalled();
  });

  // ── cacheGet ──────────────────────────────────────────────────────────
  it('cacheGet retrieves parsed JSON value', async () => {
    redisMocks.mockGet.mockResolvedValue(JSON.stringify({ name: 'test' }));
    const { initRedis, cacheGet } = await import('../cache-service');
    initRedis();
    const result = await cacheGet<{ name: string }>('test-key');
    expect(result).toEqual({ name: 'test' });
  });

  it('cacheGet logs stale-while-revalidate window and serves cached value', async () => {
    redisMocks.mockGet.mockResolvedValue(JSON.stringify({ stale: true }));
    redisMocks.mockTtl.mockResolvedValue(5);
    const { initRedis, cacheGet } = await import('../cache-service');
    initRedis();

    const result = await cacheGet<{ stale: boolean }>('sw-key', { staleWhileRevalidate: 20 });
    expect(result).toEqual({ stale: true });
    expect(redisMocks.mockTtl).toHaveBeenCalled();
  });

  it('cacheGet returns raw string for non-JSON values', async () => {
    redisMocks.mockGet.mockResolvedValue('plain-text');
    const { initRedis, cacheGet } = await import('../cache-service');
    initRedis();

    const result = await cacheGet<string>('text-key');
    expect(result).toBe('plain-text');
  });

  it('cacheGet returns null for missing key', async () => {
    const { initRedis, cacheGet } = await import('../cache-service');
    initRedis();
    const result = await cacheGet('missing-key');
    expect(result).toBeNull();
  });

  it('cacheGet returns null on redis error', async () => {
    redisMocks.mockGet.mockRejectedValue(new Error('Redis down'));
    const { initRedis, cacheGet } = await import('../cache-service');
    initRedis();
    const result = await cacheGet('err-key');
    expect(result).toBeNull();
  });

  // ── cacheSet ──────────────────────────────────────────────────────────
  it('cacheSet stores value with TTL', async () => {
    const { initRedis, cacheSet } = await import('../cache-service');
    initRedis();
    const result = await cacheSet('my-key', { data: 42 }, { ttl: 60 });
    expect(result).toBe(true);
    expect(redisMocks.mockSetex).toHaveBeenCalledWith(
      expect.stringContaining('my-key'), 60, JSON.stringify({ data: 42 }),
    );
  });

  it('cacheSet returns false on redis error', async () => {
    redisMocks.mockSetex.mockRejectedValue(new Error('write fail'));
    const { initRedis, cacheSet } = await import('../cache-service');
    initRedis();
    const result = await cacheSet('k', 'v');
    expect(result).toBe(false);
  });

  // ── cacheDelete ───────────────────────────────────────────────────────
  it('cacheDelete removes key', async () => {
    const { initRedis, cacheDelete } = await import('../cache-service');
    initRedis();
    const result = await cacheDelete('del-key');
    expect(result).toBe(true);
    expect(redisMocks.mockDel).toHaveBeenCalled();
  });

  it('cacheDelete returns false on error', async () => {
    redisMocks.mockDel.mockRejectedValue(new Error('del fail'));
    const { initRedis, cacheDelete } = await import('../cache-service');
    initRedis();
    expect(await cacheDelete('k')).toBe(false);
  });

  // ── cacheDeletePattern ────────────────────────────────────────────────
  it('cacheDeletePattern deletes matching keys', async () => {
    redisMocks.mockKeys.mockResolvedValue(['k1', 'k2']);
    const { initRedis, cacheDeletePattern } = await import('../cache-service');
    initRedis();
    const count = await cacheDeletePattern('user:*');
    expect(count).toBe(2);
    expect(redisMocks.mockDel).toHaveBeenCalledWith('k1', 'k2');
  });

  it('cacheDeletePattern returns 0 when no keys match', async () => {
    redisMocks.mockKeys.mockResolvedValue([]);
    const { initRedis, cacheDeletePattern } = await import('../cache-service');
    initRedis();
    expect(await cacheDeletePattern('no-match:*')).toBe(0);
  });

  // ── cacheExists ───────────────────────────────────────────────────────
  it('cacheExists returns true when key exists', async () => {
    redisMocks.mockExists.mockResolvedValue(1);
    const { initRedis, cacheExists } = await import('../cache-service');
    initRedis();
    expect(await cacheExists('present-key')).toBe(true);
  });

  it('cacheExists returns false when key missing', async () => {
    redisMocks.mockExists.mockResolvedValue(0);
    const { initRedis, cacheExists } = await import('../cache-service');
    initRedis();
    expect(await cacheExists('absent-key')).toBe(false);
  });

  // ── cacheGetOrSet ─────────────────────────────────────────────────────
  it('cacheGetOrSet returns cached value on hit', async () => {
    redisMocks.mockGet.mockResolvedValue(JSON.stringify({ cached: true }));
    const { initRedis, cacheGetOrSet } = await import('../cache-service');
    initRedis();
    const fetchFn = vi.fn();
    const result = await cacheGetOrSet('hit-key', fetchFn);
    expect(result).toEqual({ cached: true });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('cacheGetOrSet fetches and caches on miss', async () => {
    redisMocks.mockGet.mockResolvedValue(null);
    const { initRedis, cacheGetOrSet } = await import('../cache-service');
    initRedis();
    const fetchFn = vi.fn().mockResolvedValue({ fresh: true });
    const result = await cacheGetOrSet('miss-key', fetchFn);
    expect(result).toEqual({ fresh: true });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(redisMocks.mockSetex).toHaveBeenCalled();
  });

  it('cacheGetOrSetStale triggers background refresh when ttl is near expiry', async () => {
    redisMocks.mockGet.mockResolvedValue(JSON.stringify({ cached: true }));
    redisMocks.mockTtl.mockResolvedValue(2);
    const { initRedis, cacheGetOrSetStale } = await import('../cache-service');
    initRedis();

    const fetchFn = vi.fn().mockResolvedValue({ refreshed: true });
    const result = await cacheGetOrSetStale('stale-key', fetchFn, { staleWhileRevalidate: 10, ttl: 30 });

    expect(result).toEqual({ cached: true });
    expect(fetchFn).toHaveBeenCalledTimes(1);

    await Promise.resolve();
    expect(redisMocks.mockSetex).toHaveBeenCalled();
  });

  it('cacheGetOrSetStale logs background refresh failures without throwing', async () => {
    redisMocks.mockGet.mockResolvedValue(JSON.stringify({ cached: true }));
    redisMocks.mockTtl.mockResolvedValue(1);
    const { initRedis, cacheGetOrSetStale } = await import('../cache-service');
    initRedis();

    const fetchFn = vi.fn().mockRejectedValue(new Error('refresh failed'));
    const result = await cacheGetOrSetStale('stale-err', fetchFn, { staleWhileRevalidate: 5 });

    expect(result).toEqual({ cached: true });
    await Promise.resolve();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('cacheGetOrSetStale falls back to direct fetch when internal redis call fails', async () => {
    redisMocks.mockGet.mockResolvedValue(JSON.stringify({ cached: true }));
    redisMocks.mockTtl.mockRejectedValue(new Error('ttl failed'));
    const { initRedis, cacheGetOrSetStale } = await import('../cache-service');
    initRedis();

    const fetchFn = vi.fn().mockResolvedValue({ fallback: true });
    const result = await cacheGetOrSetStale('stale-fallback', fetchFn, { staleWhileRevalidate: 30 });

    expect(result).toEqual({ fallback: true });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  // ── Session caching ───────────────────────────────────────────────────
  it('cacheSession stores session with TTL', async () => {
    const { initRedis, cacheSession } = await import('../cache-service');
    initRedis();
    const result = await cacheSession('sess-1', {
      userId: 'u1', organizationId: 'org-1', roles: ['admin'], expiresAt: new Date(),
    });
    expect(result).toBe(true);
  });

  it('getCachedSession retrieves session', async () => {
    const session = { userId: 'u1', organizationId: 'org-1', roles: ['admin'] };
    redisMocks.mockGet.mockResolvedValue(JSON.stringify(session));
    const { initRedis, getCachedSession } = await import('../cache-service');
    initRedis();
    const result = await getCachedSession('sess-1');
    expect(result).toEqual(session);
  });

  it('invalidateSession removes session', async () => {
    const { initRedis, invalidateSession } = await import('../cache-service');
    initRedis();
    expect(await invalidateSession('sess-1')).toBe(true);
  });

  // ── Rate limiting ─────────────────────────────────────────────────────
  describe('checkRateLimit', () => {
    it('allows request when under limit', async () => {
      redisMocks.mockZcard.mockResolvedValue(2);
      const { initRedis, checkRateLimit } = await import('../cache-service');
      initRedis();
      const result = await checkRateLimit('api:user1', 10, 60);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(7); // 10 - 2 - 1
    });

    it('denies request when at limit', async () => {
      redisMocks.mockZcard.mockResolvedValue(10);
      redisMocks.mockZrange.mockResolvedValue(['ts', '1000']);
      const { initRedis, checkRateLimit } = await import('../cache-service');
      initRedis();
      const result = await checkRateLimit('api:user1', 10, 60);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('fails open on redis error', async () => {
      redisMocks.mockZremrangebyscore.mockRejectedValue(new Error('down'));
      const { initRedis, checkRateLimit } = await import('../cache-service');
      initRedis();
      const result = await checkRateLimit('api:user1', 10, 60);
      expect(result.allowed).toBe(true);
    });
  });

  describe('checkFixedRateLimit', () => {
    it('allows when under limit', async () => {
      redisMocks.mockGet.mockResolvedValue('3');
      const { initRedis, checkFixedRateLimit } = await import('../cache-service');
      initRedis();
      const result = await checkFixedRateLimit('f:user1', 10, 60);
      expect(result.allowed).toBe(true);
    });

    it('denies when at limit', async () => {
      redisMocks.mockGet.mockResolvedValue('10');
      const { initRedis, checkFixedRateLimit } = await import('../cache-service');
      initRedis();
      const result = await checkFixedRateLimit('f:user1', 10, 60);
      expect(result.allowed).toBe(false);
    });
  });

  // ── Distributed locks ─────────────────────────────────────────────────
  describe('acquireLock', () => {
    it('returns token when acquired', async () => {
      redisMocks.mockSet.mockResolvedValue('OK');
      const { initRedis, acquireLock } = await import('../cache-service');
      initRedis();
      const token = await acquireLock('my-lock', 30);
      expect(token).toBeTruthy();
    });

    it('returns null when lock is held', async () => {
      redisMocks.mockSet.mockResolvedValue(null);
      const { initRedis, acquireLock } = await import('../cache-service');
      initRedis();
      expect(await acquireLock('held-lock')).toBeNull();
    });
  });

  describe('releaseLock', () => {
    it('returns true when released', async () => {
      redisMocks.mockEval.mockResolvedValue(1);
      const { initRedis, releaseLock } = await import('../cache-service');
      initRedis();
      expect(await releaseLock('my-lock', 'token-1')).toBe(true);
    });

    it('returns false when token mismatch', async () => {
      redisMocks.mockEval.mockResolvedValue(0);
      const { initRedis, releaseLock } = await import('../cache-service');
      initRedis();
      expect(await releaseLock('my-lock', 'wrong-token')).toBe(false);
    });
  });

  describe('extendLock', () => {
    it('extends TTL when token matches', async () => {
      redisMocks.mockEval.mockResolvedValue(1);
      const { initRedis, extendLock } = await import('../cache-service');
      initRedis();
      expect(await extendLock('my-lock', 'tok', 60)).toBe(true);
    });
  });

  // ── Utility ───────────────────────────────────────────────────────────
  it('getCacheStats returns stats', async () => {
    const { initRedis, getCacheStats } = await import('../cache-service');
    initRedis();
    const stats = await getCacheStats();
    expect(stats.connected).toBe(true);
    expect(stats.keys).toBe(10);
  });

  it('getCacheStats returns fallback on error', async () => {
    redisMocks.mockInfo.mockRejectedValue(new Error('fail'));
    const { initRedis, getCacheStats } = await import('../cache-service');
    initRedis();
    const stats = await getCacheStats();
    expect(stats.connected).toBe(false);
  });

  it('pingRedis returns true on pong', async () => {
    const { initRedis, pingRedis } = await import('../cache-service');
    initRedis();
    expect(await pingRedis()).toBe(true);
  });

  it('pingRedis returns false on error', async () => {
    redisMocks.mockPing.mockRejectedValue(new Error('err'));
    const { initRedis, pingRedis } = await import('../cache-service');
    initRedis();
    expect(await pingRedis()).toBe(false);
  });

  // ── Cache warmup ──────────────────────────────────────────────────────
  it('registerCacheWarmup and executeCacheWarmup process entries', async () => {
    const { initRedis, registerCacheWarmup, executeCacheWarmup } = await import('../cache-service');
    initRedis();

    registerCacheWarmup({
      key: 'warm:1',
      fetchFn: vi.fn().mockResolvedValue({ data: 1 }),
      ttl: 60,
      priority: 1,
    });

    const result = await executeCacheWarmup();
    expect(result.total).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
  });

  it('executeCacheWarmup filters by priority and keeps registry introspection consistent', async () => {
    const {
      initRedis,
      registerCacheWarmup,
      executeCacheWarmup,
      getCacheWarmupEntries,
      clearCacheWarmupRegistry,
    } = await import('../cache-service');

    initRedis();
    clearCacheWarmupRegistry();

    registerCacheWarmup({ key: 'warm:high', fetchFn: vi.fn().mockResolvedValue({ ok: 1 }), priority: 1 });
    registerCacheWarmup({ key: 'warm:low', fetchFn: vi.fn().mockResolvedValue({ ok: 2 }), priority: 9 });

    const entries = getCacheWarmupEntries();
    expect(entries).toHaveLength(2);

    const filtered = await executeCacheWarmup({ priorityOnly: 3, parallel: 1 });
    expect(filtered.total).toBe(1);
    expect(filtered.succeeded).toBe(1);

    clearCacheWarmupRegistry();
    expect(getCacheWarmupEntries()).toHaveLength(0);
  });

  it('executeCacheWarmup sorts mixed-priority entries without filter', async () => {
    const {
      initRedis,
      registerCacheWarmup,
      executeCacheWarmup,
      clearCacheWarmupRegistry,
    } = await import('../cache-service');

    initRedis();
    clearCacheWarmupRegistry();

    const highPriorityFetch = vi.fn().mockResolvedValue({ ok: 'high' });
    const lowPriorityFetch = vi.fn().mockResolvedValue({ ok: 'low' });
    registerCacheWarmup({ key: 'warm:low-sort', fetchFn: lowPriorityFetch, priority: 9 });
    registerCacheWarmup({ key: 'warm:high-sort', fetchFn: highPriorityFetch, priority: 1 });

    const result = await executeCacheWarmup({ parallel: 2 });
    expect(result.total).toBe(2);
    expect(result.succeeded).toBe(2);
    expect(highPriorityFetch).toHaveBeenCalledTimes(1);
    expect(lowPriorityFetch).toHaveBeenCalledTimes(1);
  });

  it('scheduleCacheWarmup runs periodically and cleanup stops interval', async () => {
    const {
      initRedis,
      registerCacheWarmup,
      clearCacheWarmupRegistry,
      scheduleCacheWarmup,
    } = await import('../cache-service');

    vi.useFakeTimers();
    initRedis();
    clearCacheWarmupRegistry();

    registerCacheWarmup({ key: 'warm:timer', fetchFn: vi.fn().mockResolvedValue({ ok: true }), priority: 1 });
    const stop = scheduleCacheWarmup(20);

    await vi.advanceTimersByTimeAsync(25);
    stop();

    expect(redisMocks.mockSetex).toHaveBeenCalled();
  });
});
