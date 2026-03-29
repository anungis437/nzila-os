/**
 * Tests for rate-limiter.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const mockPipeline = {
    zremrangebyscore: vi.fn(),
    zcard: vi.fn(),
    zadd: vi.fn(),
    expire: vi.fn(),
    exec: vi.fn(),
  };
  const mockCircuitExecute = vi.fn((fn: () => Promise<unknown>) => fn());
  return {
    mockPipeline,
    mockCircuitExecute,
    mockLoggerInfo: vi.fn(),
    mockLoggerError: vi.fn(),
    mockLoggerWarn: vi.fn(),
  };
});

class MockCircuitBreakerOpenError extends Error {
  stats: Record<string, unknown>;
  constructor(msg = 'circuit open') {
    super(msg);
    this.name = 'CircuitBreakerOpenError';
    this.stats = { failures: 5 };
  }
}

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
      execute: mocks.mockCircuitExecute,
    })),
  },
  CIRCUIT_BREAKERS: { REDIS: {} },
  CircuitBreakerOpenError: MockCircuitBreakerOpenError,
}));

describe('rate-limiter', () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    // Reset circuit execute to default pass-through
    mocks.mockCircuitExecute.mockImplementation((fn: () => Promise<unknown>) => fn());
    // Set Upstash env so redis client is created
    process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  // ── checkRateLimit ──────────────────────────────────────────────────────
  describe('checkRateLimit', () => {
    it('allows requests under the limit', async () => {
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
      mocks.mockPipeline.exec.mockResolvedValue([0, 10, 1, 1]);

      const { checkRateLimit } = await import('../rate-limiter');
      const result = await checkRateLimit('user-1', {
        limit: 10,
        window: 3600,
        identifier: 'test',
      });

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(11);
      expect(result.remaining).toBe(0);
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
      expect(result.remaining).toBe(0);
    });

    it('calls pipeline operations in correct order', async () => {
      mocks.mockPipeline.exec.mockResolvedValue([0, 0, 1, 1]);

      const { checkRateLimit } = await import('../rate-limiter');
      await checkRateLimit('user-x', { limit: 5, window: 60, identifier: 'ops' });

      expect(mocks.mockPipeline.zremrangebyscore).toHaveBeenCalledTimes(1);
      expect(mocks.mockPipeline.zcard).toHaveBeenCalledTimes(1);
      expect(mocks.mockPipeline.zadd).toHaveBeenCalledTimes(1);
      expect(mocks.mockPipeline.expire).toHaveBeenCalledWith(
        'ratelimit:ops:user-x',
        70, // window + 10
      );
    });

    it('handles null count from pipeline result', async () => {
      mocks.mockPipeline.exec.mockResolvedValue([0, null, 1, 1]);

      const { checkRateLimit } = await import('../rate-limiter');
      const result = await checkRateLimit('user-1', {
        limit: 5,
        window: 60,
        identifier: 'test',
      });

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(1);
    });

    it('fails open on circuit breaker error in development', async () => {
      process.env.NODE_ENV = 'development';
      mocks.mockCircuitExecute.mockRejectedValue(new MockCircuitBreakerOpenError());

      const { checkRateLimit } = await import('../rate-limiter');
      const result = await checkRateLimit('user-1', {
        limit: 10,
        window: 3600,
        identifier: 'test',
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10);
      expect(result.error).toBeUndefined();
    });

    it('fails closed on circuit breaker error in production', async () => {
      process.env.NODE_ENV = 'production';
      mocks.mockCircuitExecute.mockRejectedValue(new MockCircuitBreakerOpenError());

      const { checkRateLimit } = await import('../rate-limiter');
      const result = await checkRateLimit('user-1', {
        limit: 10,
        window: 3600,
        identifier: 'test',
      });

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.error).toBeDefined();
    });

    it('fails open on generic Redis error in development', async () => {
      process.env.NODE_ENV = 'development';
      mocks.mockCircuitExecute.mockRejectedValue(new Error('ECONNREFUSED'));

      const { checkRateLimit } = await import('../rate-limiter');
      const result = await checkRateLimit('user-1', {
        limit: 10,
        window: 3600,
        identifier: 'test',
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10);
    });

    it('fails closed on generic Redis error in production', async () => {
      process.env.NODE_ENV = 'production';
      mocks.mockCircuitExecute.mockRejectedValue(new Error('ECONNREFUSED'));

      const { checkRateLimit } = await import('../rate-limiter');
      const result = await checkRateLimit('user-1', {
        limit: 10,
        window: 3600,
        identifier: 'test',
      });

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.error).toBeDefined();
    });
  });

  // ── checkMultiLayerRateLimit ────────────────────────────────────────────
  describe('checkMultiLayerRateLimit', () => {
    it('allows when all layers pass', async () => {
      mocks.mockPipeline.exec.mockResolvedValue([0, 1, 1, 1]);

      const { checkMultiLayerRateLimit } = await import('../rate-limiter');
      const result = await checkMultiLayerRateLimit(
        { userId: 'u1', ipAddress: '1.2.3.4', endpointKey: 'ep' },
        {
          perUser: { limit: 10, window: 60, identifier: 'u' },
          perIP: { limit: 20, window: 60, identifier: 'ip' },
          perEndpoint: { limit: 100, window: 60, identifier: 'ep' },
        },
      );

      expect(result.allowed).toBe(true);
      expect(result.failedLayer).toBeNull();
      expect(result.layers.user).toBeDefined();
      expect(result.layers.ip).toBeDefined();
      expect(result.layers.endpoint).toBeDefined();
    });

    it('reports user layer failure', async () => {
      // First call (user) over limit, rest under limit
      let callCount = 0;
      mocks.mockPipeline.exec.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve([0, 10, 1, 1]); // user: at limit
        return Promise.resolve([0, 1, 1, 1]); // ip/endpoint: under limit
      });

      const { checkMultiLayerRateLimit } = await import('../rate-limiter');
      const result = await checkMultiLayerRateLimit(
        { userId: 'u1', ipAddress: '1.2.3.4' },
        {
          perUser: { limit: 10, window: 60, identifier: 'u' },
          perIP: { limit: 20, window: 60, identifier: 'ip' },
        },
      );

      expect(result.allowed).toBe(false);
      expect(result.failedLayer).toBe('user');
    });

    it('reports ip layer failure when user passes', async () => {
      let callCount = 0;
      mocks.mockPipeline.exec.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve([0, 1, 1, 1]); // user passes
        return Promise.resolve([0, 20, 1, 1]); // ip at limit
      });

      const { checkMultiLayerRateLimit } = await import('../rate-limiter');
      const result = await checkMultiLayerRateLimit(
        { userId: 'u1', ipAddress: '1.2.3.4' },
        {
          perUser: { limit: 10, window: 60, identifier: 'u' },
          perIP: { limit: 20, window: 60, identifier: 'ip' },
        },
      );

      expect(result.allowed).toBe(false);
      expect(result.failedLayer).toBe('ip');
    });

    it('reports endpoint layer failure', async () => {
      let callCount = 0;
      mocks.mockPipeline.exec.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) return Promise.resolve([0, 1, 1, 1]); // user + ip pass
        return Promise.resolve([0, 100, 1, 1]); // endpoint at limit
      });

      const { checkMultiLayerRateLimit } = await import('../rate-limiter');
      const result = await checkMultiLayerRateLimit(
        { userId: 'u1', ipAddress: '1.2.3.4', endpointKey: 'ep' },
        {
          perUser: { limit: 10, window: 60, identifier: 'u' },
          perIP: { limit: 20, window: 60, identifier: 'ip' },
          perEndpoint: { limit: 100, window: 60, identifier: 'ep' },
        },
      );

      expect(result.allowed).toBe(false);
      expect(result.failedLayer).toBe('endpoint');
    });

    it('first failed layer wins when multiple fail', async () => {
      mocks.mockPipeline.exec.mockResolvedValue([0, 999, 1, 1]); // all over limit

      const { checkMultiLayerRateLimit } = await import('../rate-limiter');
      const result = await checkMultiLayerRateLimit(
        { userId: 'u1', ipAddress: '1.2.3.4' },
        {
          perUser: { limit: 10, window: 60, identifier: 'u' },
          perIP: { limit: 20, window: 60, identifier: 'ip' },
        },
      );

      expect(result.allowed).toBe(false);
      expect(result.failedLayer).toBe('user');
    });

    it('handles partial config with only perUser', async () => {
      mocks.mockPipeline.exec.mockResolvedValue([0, 1, 1, 1]);

      const { checkMultiLayerRateLimit } = await import('../rate-limiter');
      const result = await checkMultiLayerRateLimit(
        { userId: 'u1' },
        { perUser: { limit: 10, window: 60, identifier: 'u' } },
      );

      expect(result.allowed).toBe(true);
      expect(result.layers.user).toBeDefined();
      expect(result.layers.ip).toBeUndefined();
      expect(result.layers.endpoint).toBeUndefined();
    });

    it('returns defaults when no keys or config match', async () => {
      const { checkMultiLayerRateLimit } = await import('../rate-limiter');
      const result = await checkMultiLayerRateLimit({}, {});

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(0);
      expect(result.remaining).toBe(0);
      expect(result.resetIn).toBe(0);
    });

    it('tracks most restrictive remaining across layers', async () => {
      let callCount = 0;
      mocks.mockPipeline.exec.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve([0, 5, 1, 1]); // user: 5 used of 10
        return Promise.resolve([0, 18, 1, 1]); // ip: 18 used of 20
      });

      const { checkMultiLayerRateLimit } = await import('../rate-limiter');
      const result = await checkMultiLayerRateLimit(
        { userId: 'u1', ipAddress: '1.2.3.4' },
        {
          perUser: { limit: 10, window: 60, identifier: 'u' },
          perIP: { limit: 20, window: 120, identifier: 'ip' },
        },
      );

      expect(result.allowed).toBe(true);
      // IP layer has fewer remaining (20-18-1=1 vs 10-5-1=4)
      expect(result.remaining).toBe(1);
      // Longest resetIn wins
      expect(result.resetIn).toBe(120);
    });
  });

  // ── createRateLimitHeaders ──────────────────────────────────────────────
  describe('createRateLimitHeaders', () => {
    it('creates headers from simple rate limit result', async () => {
      const { createRateLimitHeaders } = await import('../rate-limiter');
      const headers = createRateLimitHeaders({
        allowed: true,
        current: 3,
        limit: 10,
        remaining: 7,
        resetIn: 3600,
      });

      expect(headers['X-RateLimit-Limit']).toBe('10');
      expect(headers['X-RateLimit-Remaining']).toBe('7');
      expect(headers['X-RateLimit-Reset']).toBe('3600');
      expect(headers['Retry-After']).toBe('3600');
      expect(headers['X-RateLimit-Failed-Layer']).toBeUndefined();
    });

    it('includes failed layer for multi-layer results', async () => {
      const { createRateLimitHeaders } = await import('../rate-limiter');
      const headers = createRateLimitHeaders({
        allowed: false,
        failedLayer: 'ip',
        layers: {},
        limit: 20,
        remaining: 0,
        resetIn: 60,
      });

      expect(headers['X-RateLimit-Failed-Layer']).toBe('ip');
      expect(headers['X-RateLimit-Remaining']).toBe('0');
    });

    it('omits failed layer header when null', async () => {
      const { createRateLimitHeaders } = await import('../rate-limiter');
      const headers = createRateLimitHeaders({
        allowed: true,
        failedLayer: null,
        layers: {},
        limit: 10,
        remaining: 5,
        resetIn: 60,
      });

      expect(headers['X-RateLimit-Failed-Layer']).toBeUndefined();
    });
  });

  // ── RATE_LIMITS / RATE_LIMITS_PER_IP ────────────────────────────────────
  describe('RATE_LIMITS', () => {
    it('exports predefined rate limit configs', async () => {
      const { RATE_LIMITS } = await import('../rate-limiter');
      expect(RATE_LIMITS.AI_QUERY).toBeDefined();
      expect(RATE_LIMITS.AI_QUERY.limit).toBe(20);
      expect(RATE_LIMITS.AI_QUERY.window).toBe(3600);
      expect(RATE_LIMITS.AUTH).toBeDefined();
      expect(RATE_LIMITS.EXPORTS).toBeDefined();
      expect(RATE_LIMITS.GENERAL_API.limit).toBe(1000);
    });

    it('has sensible limits for expensive operations', async () => {
      const { RATE_LIMITS } = await import('../rate-limiter');
      // AI operations should have lower limits than general API
      expect(RATE_LIMITS.AI_QUERY.limit).toBeLessThan(RATE_LIMITS.GENERAL_API.limit);
      expect(RATE_LIMITS.ML_TRAINING.limit).toBeLessThanOrEqual(RATE_LIMITS.AI_QUERY.limit);
    });

    it('covers financial and business operation categories', async () => {
      const { RATE_LIMITS } = await import('../rate-limiter');
      expect(RATE_LIMITS.DUES_PAYMENT).toBeDefined();
      expect(RATE_LIMITS.CLAIMS_CREATE).toBeDefined();
      expect(RATE_LIMITS.VOTING_CREATE).toBeDefined();
      expect(RATE_LIMITS.DOCUMENT_UPLOAD).toBeDefined();
      expect(RATE_LIMITS.CAMPAIGN_OPERATIONS).toBeDefined();
    });
  });

  describe('RATE_LIMITS_PER_IP', () => {
    it('exports per-IP rate limit configs', async () => {
      const { RATE_LIMITS_PER_IP } = await import('../rate-limiter');
      expect(RATE_LIMITS_PER_IP.AUTH).toBeDefined();
      expect(RATE_LIMITS_PER_IP.SIGNUP).toBeDefined();
      expect(RATE_LIMITS_PER_IP.GENERAL_API).toBeDefined();
    });

    it('per-IP limits are generally higher than per-user limits', async () => {
      const { RATE_LIMITS, RATE_LIMITS_PER_IP } = await import('../rate-limiter');
      expect(RATE_LIMITS_PER_IP.AUTH.limit).toBeGreaterThanOrEqual(RATE_LIMITS.AUTH.limit);
      expect(RATE_LIMITS_PER_IP.GENERAL_API.limit).toBeGreaterThanOrEqual(RATE_LIMITS.GENERAL_API.limit);
    });
  });
});
