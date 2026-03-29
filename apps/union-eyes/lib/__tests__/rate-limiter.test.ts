/**
 * Tests for rate-limiter.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const mockPipeline = {
    zremrangebyscore: vi.fn(),
    zcard: vi.fn(),
    zadd: vi.fn(),
    expire: vi.fn(),
    exec: vi.fn(),
  };
  return {
    mockPipeline,
    mockExecute: vi.fn(),
    mockLoggerInfo: vi.fn(),
    mockLoggerError: vi.fn(),
    mockLoggerWarn: vi.fn(),
  };
});

vi.mock('@upstash/redis', () => ({
  Redis: class MockRedis {
    pipeline() {
      return mocks.mockPipeline;
    }
  },
}));

vi.mock('ioredis', () => ({
  default: class MockIORedis {
    on() { return this; }
    pipeline() { return mocks.mockPipeline; }
  },
}));

vi.mock('../logger', () => ({
  logger: {
    info: mocks.mockLoggerInfo,
    error: mocks.mockLoggerError,
    warn: mocks.mockLoggerWarn,
    debug: vi.fn(),
  },
}));

vi.mock('../circuit-breaker', () => ({
  circuitBreakers: {
    get: vi.fn(() => ({
      execute: vi.fn((fn: () => Promise<unknown>) => fn()),
    })),
  },
  CIRCUIT_BREAKERS: { REDIS: {} },
  CircuitBreakerOpenError: class extends Error {
    stats = {};
  },
}));

describe('rate-limiter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('checkRateLimit', () => {
    it('allows requests under the limit', async () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

      mocks.mockPipeline.exec.mockResolvedValue([0, 3, 1, 1]);

      const { checkRateLimit } = await import('../rate-limiter');
      const result = await checkRateLimit('user-1', {
        limit: 10,
        window: 3600,
        identifier: 'test',
      });

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(4);
      expect(result.remaining).toBe(6);
    });

    it('denies requests at the limit', async () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

      mocks.mockPipeline.exec.mockResolvedValue([0, 10, 1, 1]);

      const { checkRateLimit } = await import('../rate-limiter');
      const result = await checkRateLimit('user-1', {
        limit: 10,
        window: 3600,
        identifier: 'test',
      });

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(11);
    });

    it('rejects when Redis is not configured', async () => {
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
      delete process.env.REDIS_URL;

      const { checkRateLimit } = await import('../rate-limiter');
      const result = await checkRateLimit('user-1', {
        limit: 10,
        window: 3600,
        identifier: 'test',
      });

      expect(result.allowed).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('RATE_LIMITS', () => {
    it('exports predefined rate limit configs', async () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

      const { RATE_LIMITS } = await import('../rate-limiter');
      expect(RATE_LIMITS.AI_QUERY).toBeDefined();
      expect(RATE_LIMITS.AI_QUERY.limit).toBe(20);
      expect(RATE_LIMITS.AI_QUERY.window).toBe(3600);
      expect(RATE_LIMITS.AUTH).toBeDefined();
      expect(RATE_LIMITS.EXPORTS).toBeDefined();
    });
  });
});
