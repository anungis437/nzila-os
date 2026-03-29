/**
 * Tests for scheduled-jobs.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockRunDailyAggregations: vi.fn(),
  mockWarmCache: vi.fn(),
  mockGetCacheStats: vi.fn(),
  mockExecute: vi.fn(),
  mockSelectDistinct: vi.fn(),
}));

vi.mock('@/lib/analytics-aggregation', () => ({
  aggregationService: {
    runDailyAggregations: mocks.mockRunDailyAggregations,
  },
}));

vi.mock('@/lib/analytics-middleware', () => ({
  warmAnalyticsCache: mocks.mockWarmCache,
  getAnalyticsCacheStats: mocks.mockGetCacheStats,
}));

vi.mock('@/db', () => ({
  db: {
    execute: mocks.mockExecute,
    selectDistinct: mocks.mockSelectDistinct,
  },
}));

vi.mock('@/db/schema/domains/claims', () => ({
  claims: { organizationId: 'organization_id' },
}));

vi.mock('drizzle-orm', () => ({
  sql: (strings: TemplateStringsArray) => strings.join(''),
  relations: vi.fn(() => ({})),
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { analyticsJobs, getJobsStatus, runJobManually } from '../scheduled-jobs';

describe('scheduled-jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockGetCacheStats.mockReturnValue({
      hits: 10, misses: 2, hitRate: 0.83, size: 50,
    });
  });

  describe('analyticsJobs', () => {
    it('exports an array of job configurations', () => {
      expect(Array.isArray(analyticsJobs)).toBe(true);
      expect(analyticsJobs.length).toBeGreaterThan(0);
    });

    it('each job has required properties', () => {
      for (const job of analyticsJobs) {
        expect(job.name).toBeDefined();
        expect(job.schedule).toBeDefined();
        expect(typeof job.handler).toBe('function');
        expect(typeof job.enabled).toBe('boolean');
      }
    });

    it('includes daily-aggregation job', () => {
      const job = analyticsJobs.find(j => j.name === 'daily-aggregation');
      expect(job).toBeDefined();
      expect(job!.schedule).toBe('0 2 * * *');
    });

    it('includes cache-warming job', () => {
      const job = analyticsJobs.find(j => j.name === 'cache-warming');
      expect(job).toBeDefined();
    });
  });

  describe('getJobsStatus', () => {
    it('returns status for all jobs', () => {
      const statuses = getJobsStatus();
      expect(statuses.length).toBe(analyticsJobs.length);
      expect(statuses[0]).toHaveProperty('name');
      expect(statuses[0]).toHaveProperty('schedule');
      expect(statuses[0]).toHaveProperty('enabled');
    });
  });

  describe('runJobManually', () => {
    it('executes daily aggregation handler', async () => {
      mocks.mockRunDailyAggregations.mockResolvedValue(undefined);
      await runJobManually('daily-aggregation');
      expect(mocks.mockRunDailyAggregations).toHaveBeenCalled();
    });

    it('throws for unknown job name', async () => {
      await expect(runJobManually('nonexistent-job')).rejects.toThrow('Job not found');
    });

    it('executes cache-stats handler', async () => {
      await runJobManually('cache-stats');
      expect(mocks.mockGetCacheStats).toHaveBeenCalled();
    });
  });
});
