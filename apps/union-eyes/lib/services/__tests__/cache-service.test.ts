/**
 * Cache Service — Unit Tests
 *
 * Tests:
 *   - initRedis creates Redis instance
 *   - getRedis returns singleton (lazy init)
 *   - cacheGet retrieves value
 *   - cacheSet stores value with TTL
 *   - closeRedis cleans up
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockGet, mockSetex, mockDel, mockQuit, mockOn, mockKeys } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockSetex: vi.fn(),
  mockDel: vi.fn(),
  mockQuit: vi.fn(),
  mockOn: vi.fn(),
  mockKeys: vi.fn(),
}));

vi.mock('ioredis', () => {
  function MockRedis() {
    return {
      get: mockGet,
      setex: mockSetex,
      del: mockDel,
      quit: mockQuit,
      on: mockOn,
      keys: mockKeys,
      ttl: vi.fn().mockResolvedValue(200),
    };
  }
  return { default: MockRedis };
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────────────────
// Must re-import for each test to reset the module-level singleton
// We test the exports directly

// ── Tests ────────────────────────────────────────────────────────────────────

describe('cache-service', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue(null);
    mockSetex.mockResolvedValue('OK');
    mockDel.mockResolvedValue(1);
    mockQuit.mockResolvedValue('OK');
    // Reset module to clear singleton between tests
    vi.resetModules();
  });

  it('initRedis creates Redis instance', async () => {
    const { initRedis } = await import('../cache-service');
    const redis = initRedis('redis://localhost:6379');
    expect(redis).toBeDefined();
    expect(mockOn).toHaveBeenCalled();
  });

  it('getRedis returns singleton (lazy init)', async () => {
    const { getRedis } = await import('../cache-service');
    const r1 = getRedis();
    const r2 = getRedis();
    expect(r1).toBe(r2);
  });

  it('cacheGet retrieves parsed JSON value', async () => {
    mockGet.mockResolvedValue(JSON.stringify({ name: 'test' }));

    const { initRedis, cacheGet } = await import('../cache-service');
    initRedis();

    const result = await cacheGet<{ name: string }>('test-key');
    expect(result).toEqual({ name: 'test' });
  });

  it('cacheGet returns null for missing key', async () => {
    mockGet.mockResolvedValue(null);

    const { initRedis, cacheGet } = await import('../cache-service');
    initRedis();

    const result = await cacheGet('missing-key');
    expect(result).toBeNull();
  });

  it('cacheSet stores value with TTL', async () => {
    const { initRedis, cacheSet } = await import('../cache-service');
    initRedis();

    const result = await cacheSet('my-key', { data: 42 }, { ttl: 60 });
    expect(result).toBe(true);
    expect(mockSetex).toHaveBeenCalledWith(
      expect.stringContaining('my-key'),
      60,
      JSON.stringify({ data: 42 })
    );
  });
});
