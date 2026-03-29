import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Redis before imports
vi.mock('@upstash/redis', () => ({
  Redis: vi.fn(() => null),
}));

vi.mock('@/db', () => ({
  db: {
    query: {
      aiBudgets: { findFirst: vi.fn() },
    },
  },
}));

vi.mock('@/db/schema', () => ({
  aiBudgets: { organizationId: 'organizationId', billingPeriodEnd: 'billingPeriodEnd' },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { AIRateLimiter } from '../rate-limiter';

describe('AIRateLimiter', () => {
  let limiter: AIRateLimiter;

  beforeEach(() => {
    vi.clearAllMocks();
    limiter = new AIRateLimiter();
  });

  describe('checkLimit', () => {
    it('allows requests when Redis is not configured (fail open)', async () => {
      const result = await limiter.checkLimit('org-1', 100, 0.01);
      expect(result.allowed).toBe(true);
    });
  });

  describe('recordUsage', () => {
    it('handles missing Redis gracefully', async () => {
      await expect(limiter.recordUsage('org-1', 100, 0.01)).resolves.not.toThrow();
    });
  });

  describe('getUsageStats', () => {
    it('returns zeros when Redis is not configured', async () => {
      const stats = await limiter.getUsageStats('org-1');
      expect(stats.requestsThisMinute).toBe(0);
      expect(stats.tokensThisHour).toBe(0);
      expect(stats.costToday).toBe(0);
    });
  });
});
