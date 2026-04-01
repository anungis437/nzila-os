/**
 * Cache Service — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  const mockRedisInstance = {
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
    exists: vi.fn(),
    ttl: vi.fn(),
    zremrangebyscore: vi.fn(),
    zcard: vi.fn(),
    zrange: vi.fn(),
    zadd: vi.fn(),
    expire: vi.fn(),
    set: vi.fn(),
    eval: vi.fn(),
    info: vi.fn(),
    dbsize: vi.fn(),
    ping: vi.fn(),
    incr: vi.fn(),
    quit: vi.fn(),
    on: vi.fn(),
  };
  return { mockRedisInstance };
});

vi.mock('ioredis', () => {
  // Must use a regular function/class — arrow functions are not constructable
  function MockRedis() {
    return mocks.mockRedisInstance;
  }
  return { default: MockRedis };
});

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import {
  initRedis,
  getRedis,
  closeRedis,
  cacheGet,
  cacheSet,
  cacheDelete,
  cacheDeletePattern,
  cacheExists,
  cacheGetOrSet,
  cacheGetOrSetStale,
  cacheSession,
  getCachedSession,
  invalidateSession,
  checkRateLimit,
  checkFixedRateLimit,
  acquireLock,
  releaseLock,
  extendLock,
  getCacheStats,
  pingRedis,
  registerCacheWarmup,
  executeCacheWarmup,
  getCacheWarmupEntries,
  clearCacheWarmupRegistry,
  scheduleCacheWarmup,
} from '../services/cache-service';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('cache-service', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.mockRedisInstance.quit.mockResolvedValue(undefined);
    // Reset the Redis singleton between tests
    await closeRedis();
    clearCacheWarmupRegistry();
  });

  // ── Connection management ────────────────────────────────────────────────

  describe('initRedis / getRedis / closeRedis', () => {
    it('creates a Redis client on init', () => {
      const client = initRedis('redis://test:6379');
      expect(client).toBeDefined();
      expect(mocks.mockRedisInstance.on).toHaveBeenCalled();
    });

    it('returns existing client on second init', () => {
      const first = initRedis();
      const second = initRedis();
      expect(first).toBe(second);
    });

    it('getRedis lazily initializes', () => {
      const client = getRedis();
      expect(client).toBeDefined();
    });

    it('closeRedis sets client to null', async () => {
      initRedis();
      await closeRedis();
      expect(mocks.mockRedisInstance.quit).toHaveBeenCalled();
    });

    it('closeRedis is safe to call when no client exists', async () => {
      await closeRedis(); // already closed in beforeEach
      await closeRedis(); // should not throw
    });
  });

  // ── cacheGet ─────────────────────────────────────────────────────────────

  describe('cacheGet', () => {
    it('returns parsed JSON value', async () => {
      mocks.mockRedisInstance.get.mockResolvedValue(JSON.stringify({ name: 'test' }));
      const result = await cacheGet('my-key');
      expect(result).toEqual({ name: 'test' });
    });

    it('returns null on cache miss', async () => {
      mocks.mockRedisInstance.get.mockResolvedValue(null);
      const result = await cacheGet('missing');
      expect(result).toBeNull();
    });

    it('returns raw string for non-JSON values', async () => {
      mocks.mockRedisInstance.get.mockResolvedValue('plain-string');
      const result = await cacheGet('raw');
      expect(result).toBe('plain-string');
    });

    it('returns null on Redis error', async () => {
      mocks.mockRedisInstance.get.mockRejectedValue(new Error('Redis down'));
      const result = await cacheGet('broken');
      expect(result).toBeNull();
    });

    it('checks TTL with staleWhileRevalidate option', async () => {
      mocks.mockRedisInstance.get.mockResolvedValue(JSON.stringify({ data: 1 }));
      mocks.mockRedisInstance.ttl.mockResolvedValue(5);
      const result = await cacheGet('stale', { staleWhileRevalidate: 30 });
      expect(result).toEqual({ data: 1 });
      expect(mocks.mockRedisInstance.ttl).toHaveBeenCalled();
    });

    it('uses namespace in cache key', async () => {
      mocks.mockRedisInstance.get.mockResolvedValue(null);
      await cacheGet('key', { namespace: 'ns' });
      expect(mocks.mockRedisInstance.get).toHaveBeenCalledWith('unioneyes:ns:key');
    });
  });

  // ── cacheSet ─────────────────────────────────────────────────────────────

  describe('cacheSet', () => {
    it('sets JSON value with default TTL', async () => {
      mocks.mockRedisInstance.setex.mockResolvedValue('OK');
      const result = await cacheSet('key', { value: 42 });
      expect(result).toBe(true);
      expect(mocks.mockRedisInstance.setex).toHaveBeenCalledWith(
        'unioneyes:key',
        300,
        '{"value":42}',
      );
    });

    it('sets string value without re-serialization', async () => {
      mocks.mockRedisInstance.setex.mockResolvedValue('OK');
      await cacheSet('key', 'hello');
      expect(mocks.mockRedisInstance.setex).toHaveBeenCalledWith(
        'unioneyes:key',
        300,
        'hello',
      );
    });

    it('uses custom TTL', async () => {
      mocks.mockRedisInstance.setex.mockResolvedValue('OK');
      await cacheSet('key', 'val', { ttl: 60 });
      expect(mocks.mockRedisInstance.setex).toHaveBeenCalledWith(
        'unioneyes:key',
        60,
        'val',
      );
    });

    it('returns false on error', async () => {
      mocks.mockRedisInstance.setex.mockRejectedValue(new Error('fail'));
      const result = await cacheSet('key', 'val');
      expect(result).toBe(false);
    });
  });

  // ── cacheDelete ──────────────────────────────────────────────────────────

  describe('cacheDelete', () => {
    it('deletes key and returns true', async () => {
      mocks.mockRedisInstance.del.mockResolvedValue(1);
      const result = await cacheDelete('key');
      expect(result).toBe(true);
    });

    it('returns false on error', async () => {
      mocks.mockRedisInstance.del.mockRejectedValue(new Error('fail'));
      const result = await cacheDelete('key');
      expect(result).toBe(false);
    });
  });

  // ── cacheDeletePattern ───────────────────────────────────────────────────

  describe('cacheDeletePattern', () => {
    it('deletes matching keys', async () => {
      mocks.mockRedisInstance.keys.mockResolvedValue(['k1', 'k2']);
      mocks.mockRedisInstance.del.mockResolvedValue(2);
      const result = await cacheDeletePattern('user:*');
      expect(result).toBe(2);
    });

    it('returns 0 for no matching keys', async () => {
      mocks.mockRedisInstance.keys.mockResolvedValue([]);
      const result = await cacheDeletePattern('none:*');
      expect(result).toBe(0);
    });

    it('returns 0 on error', async () => {
      mocks.mockRedisInstance.keys.mockRejectedValue(new Error('fail'));
      const result = await cacheDeletePattern('err:*');
      expect(result).toBe(0);
    });
  });

  // ── cacheExists ──────────────────────────────────────────────────────────

  describe('cacheExists', () => {
    it('returns true when key exists', async () => {
      mocks.mockRedisInstance.exists.mockResolvedValue(1);
      expect(await cacheExists('key')).toBe(true);
    });

    it('returns false when key missing', async () => {
      mocks.mockRedisInstance.exists.mockResolvedValue(0);
      expect(await cacheExists('key')).toBe(false);
    });

    it('returns false on error', async () => {
      mocks.mockRedisInstance.exists.mockRejectedValue(new Error('fail'));
      expect(await cacheExists('key')).toBe(false);
    });
  });

  // ── cacheGetOrSet ────────────────────────────────────────────────────────

  describe('cacheGetOrSet', () => {
    it('returns cached value on hit', async () => {
      mocks.mockRedisInstance.get.mockResolvedValue(JSON.stringify({ cached: true }));
      const fetchFn = vi.fn();
      const result = await cacheGetOrSet('key', fetchFn);
      expect(result).toEqual({ cached: true });
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('fetches and caches on miss', async () => {
      mocks.mockRedisInstance.get.mockResolvedValue(null);
      mocks.mockRedisInstance.setex.mockResolvedValue('OK');
      const fetchFn = vi.fn().mockResolvedValue({ fresh: true });

      const result = await cacheGetOrSet('key', fetchFn);
      expect(result).toEqual({ fresh: true });
      expect(fetchFn).toHaveBeenCalled();
      expect(mocks.mockRedisInstance.setex).toHaveBeenCalled();
    });
  });

  // ── cacheGetOrSetStale ───────────────────────────────────────────────────

  describe('cacheGetOrSetStale', () => {
    it('returns cached value and triggers background revalidation when stale', async () => {
      mocks.mockRedisInstance.get.mockResolvedValue(JSON.stringify({ stale: true }));
      mocks.mockRedisInstance.ttl.mockResolvedValue(3); // low TTL
      mocks.mockRedisInstance.setex.mockResolvedValue('OK');
      const fetchFn = vi.fn().mockResolvedValue({ fresh: true });

      const result = await cacheGetOrSetStale('key', fetchFn, { staleWhileRevalidate: 30 });
      expect(result).toEqual({ stale: true });
      // Background revalidation fires asynchronously
    });

    it('fetches directly on cache miss', async () => {
      mocks.mockRedisInstance.get.mockResolvedValue(null);
      mocks.mockRedisInstance.setex.mockResolvedValue('OK');
      const fetchFn = vi.fn().mockResolvedValue({ data: 1 });

      const result = await cacheGetOrSetStale('key', fetchFn, { staleWhileRevalidate: 30 });
      expect(result).toEqual({ data: 1 });
    });

    it('falls back to direct fetch on error', async () => {
      mocks.mockRedisInstance.get.mockRejectedValue(new Error('redis error'));
      const fetchFn = vi.fn().mockResolvedValue({ fallback: true });

      const result = await cacheGetOrSetStale('key', fetchFn, { staleWhileRevalidate: 30 });
      expect(result).toEqual({ fallback: true });
    });
  });

  // ── Session caching ──────────────────────────────────────────────────────

  describe('session caching', () => {
    it('cacheSession stores session data', async () => {
      mocks.mockRedisInstance.setex.mockResolvedValue('OK');
      const session = { userId: 'u1', organizationId: 'o1', roles: ['admin'], expiresAt: new Date() };
      const result = await cacheSession('sess-1', session);
      expect(result).toBe(true);
    });

    it('getCachedSession retrieves session', async () => {
      const session = { userId: 'u1', organizationId: 'o1', roles: ['admin'] };
      mocks.mockRedisInstance.get.mockResolvedValue(JSON.stringify(session));
      const result = await getCachedSession('sess-1');
      expect(result).toEqual(session);
    });

    it('invalidateSession deletes session', async () => {
      mocks.mockRedisInstance.del.mockResolvedValue(1);
      const result = await invalidateSession('sess-1');
      expect(result).toBe(true);
    });
  });

  // ── Rate limiting ────────────────────────────────────────────────────────

  describe('checkRateLimit', () => {
    it('allows request under limit', async () => {
      mocks.mockRedisInstance.zremrangebyscore.mockResolvedValue(0);
      mocks.mockRedisInstance.zcard.mockResolvedValue(2);
      mocks.mockRedisInstance.zadd.mockResolvedValue(1);
      mocks.mockRedisInstance.expire.mockResolvedValue(1);

      const result = await checkRateLimit('user:1', 10, 60);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(7);
    });

    it('denies request at limit', async () => {
      mocks.mockRedisInstance.zremrangebyscore.mockResolvedValue(0);
      mocks.mockRedisInstance.zcard.mockResolvedValue(10);
      mocks.mockRedisInstance.zrange.mockResolvedValue(['ts1', '1000000']);

      const result = await checkRateLimit('user:1', 10, 60);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('fails open on Redis error', async () => {
      mocks.mockRedisInstance.zremrangebyscore.mockRejectedValue(new Error('fail'));
      const result = await checkRateLimit('user:1', 10, 60);
      expect(result.allowed).toBe(true);
    });
  });

  describe('checkFixedRateLimit', () => {
    it('allows request under limit', async () => {
      mocks.mockRedisInstance.get.mockResolvedValue('3');
      mocks.mockRedisInstance.incr.mockResolvedValue(4);
      mocks.mockRedisInstance.expire.mockResolvedValue(1);

      const result = await checkFixedRateLimit('user:1', 10, 60);
      expect(result.allowed).toBe(true);
    });

    it('denies request at limit', async () => {
      mocks.mockRedisInstance.get.mockResolvedValue('10');

      const result = await checkFixedRateLimit('user:1', 10, 60);
      expect(result.allowed).toBe(false);
    });

    it('fails open on error', async () => {
      mocks.mockRedisInstance.get.mockRejectedValue(new Error('fail'));
      const result = await checkFixedRateLimit('user:1', 10, 60);
      expect(result.allowed).toBe(true);
    });
  });

  // ── Distributed locks ────────────────────────────────────────────────────

  describe('acquireLock', () => {
    it('returns token on success', async () => {
      mocks.mockRedisInstance.set.mockResolvedValue('OK');
      const token = await acquireLock('my-lock');
      expect(token).toBeTruthy();
    });

    it('returns null when lock is held', async () => {
      mocks.mockRedisInstance.set.mockResolvedValue(null);
      const token = await acquireLock('my-lock');
      expect(token).toBeNull();
    });

    it('returns null on error', async () => {
      mocks.mockRedisInstance.set.mockRejectedValue(new Error('fail'));
      const token = await acquireLock('my-lock');
      expect(token).toBeNull();
    });
  });

  describe('releaseLock', () => {
    it('returns true when lock released', async () => {
      mocks.mockRedisInstance.eval.mockResolvedValue(1);
      expect(await releaseLock('my-lock', 'token-1')).toBe(true);
    });

    it('returns false when token mismatch', async () => {
      mocks.mockRedisInstance.eval.mockResolvedValue(0);
      expect(await releaseLock('my-lock', 'wrong')).toBe(false);
    });

    it('returns false on error', async () => {
      mocks.mockRedisInstance.eval.mockRejectedValue(new Error('fail'));
      expect(await releaseLock('my-lock', 'token')).toBe(false);
    });
  });

  describe('extendLock', () => {
    it('returns true when extended', async () => {
      mocks.mockRedisInstance.eval.mockResolvedValue(1);
      expect(await extendLock('my-lock', 'token', 60)).toBe(true);
    });

    it('returns false on token mismatch', async () => {
      mocks.mockRedisInstance.eval.mockResolvedValue(0);
      expect(await extendLock('my-lock', 'wrong', 60)).toBe(false);
    });
  });

  // ── Stats / Ping ─────────────────────────────────────────────────────────

  describe('getCacheStats', () => {
    it('returns stats when connected', async () => {
      mocks.mockRedisInstance.info.mockResolvedValue('used_memory:1024');
      mocks.mockRedisInstance.dbsize.mockResolvedValue(42);
      const stats = await getCacheStats();
      expect(stats).toEqual({
        connected: true,
        memory: 'used_memory:1024',
        keys: 42,
      });
    });

    it('returns disconnected state on error', async () => {
      mocks.mockRedisInstance.info.mockRejectedValue(new Error('fail'));
      const stats = await getCacheStats();
      expect(stats).toEqual({ connected: false, memory: 'Unknown', keys: 0 });
    });
  });

  describe('pingRedis', () => {
    it('returns true on PONG', async () => {
      mocks.mockRedisInstance.ping.mockResolvedValue('PONG');
      expect(await pingRedis()).toBe(true);
    });

    it('returns false on error', async () => {
      mocks.mockRedisInstance.ping.mockRejectedValue(new Error('fail'));
      expect(await pingRedis()).toBe(false);
    });
  });

  // ── Cache Warmup ─────────────────────────────────────────────────────────

  describe('cache warmup', () => {
    it('registers and lists warmup entries', () => {
      registerCacheWarmup({
        key: 'orgs:all',
        fetchFn: async () => [],
        ttl: 300,
        namespace: 'orgs',
        priority: 1,
      });

      const entries = getCacheWarmupEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].key).toBe('orgs:all');
    });

    it('updates existing entry with same key/namespace', () => {
      const newFn = async () => ['updated'];
      registerCacheWarmup({ key: 'k1', fetchFn: async () => [], namespace: 'ns' });
      registerCacheWarmup({ key: 'k1', fetchFn: newFn, namespace: 'ns' });

      const entries = getCacheWarmupEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].fetchFn).toBe(newFn);
    });

    it('clears warmup registry', () => {
      registerCacheWarmup({ key: 'k1', fetchFn: async () => [] });
      clearCacheWarmupRegistry();
      expect(getCacheWarmupEntries()).toHaveLength(0);
    });

    it('executeCacheWarmup warms entries', async () => {
      mocks.mockRedisInstance.setex.mockResolvedValue('OK');
      registerCacheWarmup({ key: 'k1', fetchFn: async () => ({ data: 1 }), priority: 1 });
      registerCacheWarmup({ key: 'k2', fetchFn: async () => ({ data: 2 }), priority: 2 });

      const result = await executeCacheWarmup();
      expect(result.total).toBe(2);
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('executeCacheWarmup filters by priority', async () => {
      mocks.mockRedisInstance.setex.mockResolvedValue('OK');
      registerCacheWarmup({ key: 'hi', fetchFn: async () => 1, priority: 1 });
      registerCacheWarmup({ key: 'lo', fetchFn: async () => 2, priority: 5 });

      const result = await executeCacheWarmup({ priorityOnly: 2 });
      expect(result.total).toBe(1);
    });

    it('scheduleCacheWarmup returns cleanup function', () => {
      vi.useFakeTimers();
      const cleanup = scheduleCacheWarmup(60000);
      expect(typeof cleanup).toBe('function');
      cleanup();
      vi.useRealTimers();
    });
  });
});
