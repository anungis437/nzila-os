/**
 * Tests for csrf-protection.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  // Set env before module loads
  process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
  return {
    mockSetex: vi.fn(),
    mockGet: vi.fn(),
    mockDel: vi.fn(),
  };
});

vi.mock('@upstash/redis', () => ({
  Redis: class MockRedis {
    setex = mocks.mockSetex;
    get = mocks.mockGet;
    del = mocks.mockDel;
  },
}));

vi.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: vi.fn((body: any, init?: ResponseInit) => ({
      body, status: init?.status || 200,
    })),
  },
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(),
    set: vi.fn(),
  })),
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { generateCSRFToken, validateCSRFToken, invalidateCSRFToken } from '../csrf-protection';

describe('csrf-protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateCSRFToken', () => {
    it('generates a non-empty token string', async () => {
      mocks.mockSetex.mockResolvedValue('OK');
      const token = await generateCSRFToken('session-1');
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(10);
    });

    it('stores token in Redis', async () => {
      mocks.mockSetex.mockResolvedValue('OK');
      await generateCSRFToken('session-1');
      expect(mocks.mockSetex).toHaveBeenCalledWith(
        'csrf:token:session-1',
        3600,
        expect.any(String),
      );
    });

    it('returns token even when Redis fails', async () => {
      mocks.mockSetex.mockRejectedValue(new Error('Redis down'));
      const token = await generateCSRFToken('session-1');
      expect(token).toBeDefined();
      expect(token.length).toBeGreaterThan(10);
    });
  });

  describe('validateCSRFToken', () => {
    it('returns false for empty token', async () => {
      const valid = await validateCSRFToken('session-1', '');
      expect(valid).toBe(false);
    });

    it('returns false when token not found in Redis', async () => {
      mocks.mockGet.mockResolvedValue(null);
      const valid = await validateCSRFToken('session-1', 'some-token');
      expect(valid).toBe(false);
    });

    it('returns true when tokens match', async () => {
      const token = 'matching-token-value-here';
      mocks.mockGet.mockResolvedValue(token);
      const valid = await validateCSRFToken('session-1', token);
      expect(valid).toBe(true);
    });

    it('returns false on token mismatch', async () => {
      mocks.mockGet.mockResolvedValue('correct-token');
      // timingSafeEqual will throw if lengths don't match
      const valid = await validateCSRFToken('session-1', 'wrong-token!!');
      expect(valid).toBe(false);
    });
  });

  describe('invalidateCSRFToken', () => {
    it('deletes token from Redis', async () => {
      mocks.mockDel.mockResolvedValue(1);
      await invalidateCSRFToken('session-1');
      expect(mocks.mockDel).toHaveBeenCalledWith('csrf:token:session-1');
    });

    it('handles Redis errors gracefully', async () => {
      mocks.mockDel.mockRejectedValue(new Error('Redis down'));
      await expect(invalidateCSRFToken('session-1')).resolves.not.toThrow();
    });
  });
});
