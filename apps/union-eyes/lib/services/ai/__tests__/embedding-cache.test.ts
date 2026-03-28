import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockRedisGet: vi.fn(),
  mockRedisSet: vi.fn(),
  mockRedisDel: vi.fn(),
  mockRedisScan: vi.fn(),
  mockCreateHash: vi.fn(),
}));

vi.mock('@upstash/redis', () => ({
  Redis: class MockRedis {
    get = mocks.mockRedisGet;
    set = mocks.mockRedisSet;
    del = mocks.mockRedisDel;
    scan = mocks.mockRedisScan;
  },
}));

vi.mock('crypto', () => ({
  createHash: mocks.mockCreateHash,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Set env vars before import
process.env.UPSTASH_REDIS_REST_URL = 'https://test-redis.upstash.io';
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

// Need to import after setting env vars and mocks
const { embeddingCache } = await import('../embedding-cache');

describe('EmbeddingCacheService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.mockCreateHash.mockReturnValue({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue('hash-abc123'),
    });

    mocks.mockRedisGet.mockResolvedValue(null);
    mocks.mockRedisSet.mockResolvedValue('OK');
    mocks.mockRedisDel.mockResolvedValue(1);
  });

  describe('getCachedEmbedding', () => {
    it('returns null on cache miss', async () => {
      mocks.mockRedisGet.mockResolvedValue(null);
      const result = await embeddingCache.getCachedEmbedding('test text', 'text-embedding-3-small');
      expect(result).toBeNull();
    });

    it('returns embedding on cache hit', async () => {
      const cached = {
        embedding: [0.1, 0.2, 0.3],
        model: 'text-embedding-3-small',
        text: 'test text',
        createdAt: Date.now(),
        hits: 5,
      };
      mocks.mockRedisGet.mockResolvedValue(cached);
      const result = await embeddingCache.getCachedEmbedding('test text', 'text-embedding-3-small');
      expect(result).toEqual([0.1, 0.2, 0.3]);
    });

    it('increments hit count on cache hit', async () => {
      const cached = {
        embedding: [0.1],
        model: 'text-embedding-3-small',
        text: 'test',
        createdAt: Date.now(),
        hits: 3,
      };
      mocks.mockRedisGet.mockResolvedValue(cached);
      await embeddingCache.getCachedEmbedding('test', 'text-embedding-3-small');
      expect(mocks.mockRedisSet).toHaveBeenCalled();
    });

    it('returns null on redis error (fail-open)', async () => {
      mocks.mockRedisGet.mockRejectedValue(new Error('Redis down'));
      const result = await embeddingCache.getCachedEmbedding('test', 'text-embedding-3-small');
      expect(result).toBeNull();
    });
  });

  describe('setCachedEmbedding', () => {
    it('stores embedding in redis', async () => {
      await embeddingCache.setCachedEmbedding('test text', 'text-embedding-3-small', [0.1, 0.2]);
      expect(mocks.mockRedisSet).toHaveBeenCalledWith(
        expect.stringContaining('ai:embedding:cache'),
        expect.objectContaining({ embedding: [0.1, 0.2] }),
        expect.objectContaining({ ex: expect.any(Number) }),
      );
    });

    it('truncates text to 200 chars for storage', async () => {
      const longText = 'a'.repeat(500);
      await embeddingCache.setCachedEmbedding(longText, 'text-embedding-3-small', [0.1]);
      const storedData = mocks.mockRedisSet.mock.calls[0][1];
      expect(storedData.text.length).toBeLessThanOrEqual(200);
    });

    it('silently fails on redis error', async () => {
      mocks.mockRedisSet.mockRejectedValue(new Error('Redis down'));
      await expect(
        embeddingCache.setCachedEmbedding('test', 'text-embedding-3-small', [0.1]),
      ).resolves.toBeUndefined();
    });
  });

  describe('getStats', () => {
    it('returns cache statistics', async () => {
      const stats = await embeddingCache.getStats();
      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('cacheHits');
      expect(stats).toHaveProperty('cacheMisses');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('estimatedCostSavings');
    });
  });

  describe('clearCache', () => {
    it('deletes all cache keys', async () => {
      mocks.mockRedisScan.mockResolvedValue([0, ['key1', 'key2']]);
      mocks.mockRedisDel.mockResolvedValue(1);
      const result = await embeddingCache.clearCache();
      expect(result.deleted).toBe(2);
    });

    it('returns 0 if no keys found', async () => {
      mocks.mockRedisScan.mockResolvedValue([0, []]);
      const result = await embeddingCache.clearCache();
      expect(result.deleted).toBe(0);
    });
  });

  describe('resetStats', () => {
    it('resets statistics to zero', async () => {
      await embeddingCache.resetStats();
      expect(mocks.mockRedisSet).toHaveBeenCalled();
    });
  });
});
