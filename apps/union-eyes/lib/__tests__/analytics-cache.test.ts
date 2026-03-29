import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  process.env.UPSTASH_REDIS_REST_URL = 'https://fake.upstash.io';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';
  return {
    mockGet: vi.fn(),
    mockSet: vi.fn(),
    mockDel: vi.fn(),
    mockKeys: vi.fn(),
  };
});

vi.mock('@upstash/redis', () => ({
  Redis: class {
    get = mocks.mockGet;
    set = mocks.mockSet;
    del = mocks.mockDel;
    keys = mocks.mockKeys;
  },
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { analyticsCache, withCache } from '../analytics-cache';

describe('AnalyticsCacheService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('get returns null on cache miss', async () => {
    mocks.mockGet.mockResolvedValue(null);

    const result = await analyticsCache.get('org1', 'claims');
    expect(result).toBeNull();
  });

  it('get returns data on cache hit', async () => {
    mocks.mockGet.mockResolvedValue({
      data: { count: 42 },
      timestamp: Date.now(),
      ttl: 300,
      hits: 0,
    });
    mocks.mockSet.mockResolvedValue('OK');

    const result = await analyticsCache.get('org1', 'claims');
    expect(result).toEqual({ count: 42 });
  });

  it('set stores data in Redis', async () => {
    mocks.mockSet.mockResolvedValue('OK');

    await analyticsCache.set('org1', 'claims', { total: 10 });
    expect(mocks.mockSet).toHaveBeenCalled();
  });

  it('invalidate deletes matching keys', async () => {
    mocks.mockKeys.mockResolvedValue(['k1', 'k2']);
    mocks.mockDel.mockResolvedValue(2);

    await analyticsCache.invalidate('org1', 'claims');
    expect(mocks.mockDel).toHaveBeenCalledWith('k1', 'k2');
  });

  it('clear deletes all analytics cache keys', async () => {
    mocks.mockKeys.mockResolvedValue(['k1']);
    mocks.mockDel.mockResolvedValue(1);

    await analyticsCache.clear();
    expect(mocks.mockDel).toHaveBeenCalled();
  });
});

describe('withCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns cached data when available', async () => {
    mocks.mockGet.mockResolvedValue({
      data: 'cached-value',
      timestamp: Date.now(),
      ttl: 300,
      hits: 0,
    });
    mocks.mockSet.mockResolvedValue('OK');

    const fetchFn = vi.fn().mockResolvedValue('fresh');
    const result = await withCache('org1', 'test', {}, fetchFn);

    expect(result).toBe('cached-value');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('fetches and caches when cache miss', async () => {
    mocks.mockGet.mockResolvedValue(null);
    mocks.mockSet.mockResolvedValue('OK');

    const fetchFn = vi.fn().mockResolvedValue('fresh-data');
    const result = await withCache('org1', 'test', {}, fetchFn);

    expect(result).toBe('fresh-data');
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(mocks.mockSet).toHaveBeenCalled();
  });
});
