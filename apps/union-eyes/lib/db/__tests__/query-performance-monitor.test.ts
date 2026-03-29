import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/db/db', () => ({ db: { execute: vi.fn() } }));
vi.mock('drizzle-orm', () => ({ sql: vi.fn() }));
vi.mock('@/lib/observability/metrics', () => ({
  dbQueryDuration: { observe: vi.fn() },
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  withQueryMonitoring,
  getRecentSlowQueries,
  getQueryPatterns,
  clearQueryPatterns,
  getQueryPerformanceSummary,
  type QueryPerformanceConfig,
  type SlowQueryLog,
  type QueryPattern,
  type QueryPerformanceSummary,
} from '../query-performance-monitor';
import { dbQueryDuration } from '@/lib/observability/metrics';

describe('query-performance-monitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearQueryPatterns();
  });

  describe('withQueryMonitoring', () => {
    it('returns the result of the query function', async () => {
      const result = await withQueryMonitoring('testQuery', async () => [
        { id: 1 },
      ]);
      expect(result).toEqual([{ id: 1 }]);
    });

    it('records duration metric', async () => {
      await withQueryMonitoring('myOp', async () => 'ok');
      expect(dbQueryDuration.observe).toHaveBeenCalledWith(
        { operation: 'myOp' },
        expect.any(Number),
      );
    });

    it('propagates errors from the query function', async () => {
      await expect(
        withQueryMonitoring('fail', async () => {
          throw new Error('db down');
        }),
      ).rejects.toThrow('db down');
    });

    it('updates query patterns when enablePatternAnalysis is true', async () => {
      await withQueryMonitoring('patternTest', async () => null, {
        enablePatternAnalysis: true,
      });
      const patterns = getQueryPatterns();
      expect(patterns.some((p) => p.pattern === 'patternTest')).toBe(true);
    });

    it('skips pattern analysis when disabled', async () => {
      await withQueryMonitoring('noPattern', async () => null, {
        enablePatternAnalysis: false,
      });
      const patterns = getQueryPatterns();
      expect(patterns.some((p) => p.pattern === 'noPattern')).toBe(false);
    });

    it('logs slow queries above threshold', async () => {
      await withQueryMonitoring(
        'slowOne',
        async () => {
          // simulate slow query
          const start = Date.now();
          while (Date.now() - start < 15) {
            /* spin */
          }
          return null;
        },
        { slowQueryThreshold: 1, sampleRate: 1 },
      );
      const slow = getRecentSlowQueries(100);
      expect(slow.some((s) => s.query === 'slowOne')).toBe(true);
    });
  });

  describe('getRecentSlowQueries', () => {
    it('returns an array', () => {
      const result = getRecentSlowQueries();
      expect(Array.isArray(result)).toBe(true);
    });

    it('respects limit parameter', async () => {
      // Log several slow queries
      for (let i = 0; i < 5; i++) {
        await withQueryMonitoring(
          `slow${i}`,
          async () => {
            const start = Date.now();
            while (Date.now() - start < 15) { /* spin */ }
            return null;
          },
          { slowQueryThreshold: 1, sampleRate: 1 },
        );
      }
      const result = getRecentSlowQueries(2);
      expect(result.length).toBeLessThanOrEqual(2);
    });

    it('returns most recent queries first (reversed)', async () => {
      for (const name of ['first', 'second', 'third']) {
        await withQueryMonitoring(
          name,
          async () => {
            const start = Date.now();
            while (Date.now() - start < 15) { /* spin */ }
            return null;
          },
          { slowQueryThreshold: 1, sampleRate: 1 },
        );
      }
      const result = getRecentSlowQueries(10);
      expect(result[0].query).toBe('third');
    });
  });

  describe('getQueryPatterns', () => {
    it('returns empty array when no patterns recorded', () => {
      expect(getQueryPatterns()).toEqual([]);
    });

    it('sorts by count (default)', async () => {
      for (let i = 0; i < 3; i++) {
        await withQueryMonitoring('frequent', async () => null);
      }
      await withQueryMonitoring('rare', async () => null);
      const patterns = getQueryPatterns('count');
      expect(patterns[0].pattern).toBe('frequent');
      expect(patterns[0].count).toBe(3);
    });

    it('sorts by avgDuration', async () => {
      // Run a fast query
      await withQueryMonitoring('fast', async () => null);
      // Run a slower query
      await withQueryMonitoring('slow', async () => {
        const start = Date.now();
        while (Date.now() - start < 20) { /* spin */ }
        return null;
      });
      const patterns = getQueryPatterns('avgDuration');
      expect(patterns[0].pattern).toBe('slow');
    });

    it('sorts by maxDuration', async () => {
      await withQueryMonitoring('low', async () => null);
      await withQueryMonitoring('high', async () => {
        const start = Date.now();
        while (Date.now() - start < 20) { /* spin */ }
        return null;
      });
      const patterns = getQueryPatterns('maxDuration');
      expect(patterns[0].pattern).toBe('high');
    });

    it('accumulates counts for the same pattern', async () => {
      await withQueryMonitoring('sameQuery', async () => null);
      await withQueryMonitoring('sameQuery', async () => null);
      const patterns = getQueryPatterns();
      const match = patterns.find((p) => p.pattern === 'sameQuery');
      expect(match?.count).toBe(2);
    });
  });

  describe('clearQueryPatterns', () => {
    it('clears all stored patterns', async () => {
      await withQueryMonitoring('toClear', async () => null);
      expect(getQueryPatterns().length).toBeGreaterThan(0);
      clearQueryPatterns();
      expect(getQueryPatterns()).toEqual([]);
    });
  });

  describe('getQueryPerformanceSummary', () => {
    it('returns zero summary when no data', () => {
      const summary = getQueryPerformanceSummary();
      expect(summary.totalQueries).toBe(0);
      expect(summary.avgDurationMs).toBe(0);
      expect(summary.maxDurationMs).toBe(0);
      expect(summary.topSlowPatterns).toEqual([]);
    });

    it('returns accurate summary after queries', async () => {
      for (let i = 0; i < 3; i++) {
        await withQueryMonitoring('sumQuery', async () => null);
      }
      const summary = getQueryPerformanceSummary();
      expect(summary.totalQueries).toBe(3);
      expect(summary.avgDurationMs).toBeGreaterThanOrEqual(0);
      expect(summary.topSlowPatterns.length).toBeGreaterThan(0);
    });
  });

  describe('type exports', () => {
    it('QueryPerformanceConfig shape', () => {
      const config: QueryPerformanceConfig = {
        slowQueryThreshold: 100,
        enablePatternAnalysis: true,
        sampleRate: 1,
        maxQueryLength: 500,
      };
      expect(config.slowQueryThreshold).toBe(100);
    });

    it('SlowQueryLog shape', () => {
      const log: SlowQueryLog = {
        query: 'SELECT 1',
        durationMs: 50,
        timestamp: new Date(),
      };
      expect(log).toHaveProperty('query');
    });

    it('QueryPattern shape', () => {
      const p: QueryPattern = {
        pattern: 'qp',
        count: 1,
        avgDurationMs: 10,
        maxDurationMs: 10,
        lastSeen: new Date(),
      };
      expect(p.count).toBe(1);
    });

    it('QueryPerformanceSummary shape', () => {
      const s: QueryPerformanceSummary = {
        totalQueries: 0,
        slowQueries: 0,
        avgDurationMs: 0,
        maxDurationMs: 0,
        topSlowPatterns: [],
        recentSlowQueries: [],
      };
      expect(s).toHaveProperty('totalQueries');
    });
  });

  describe('recommendation generation (via slow query logs)', () => {
    it('generates recommendation for LIKE queries', async () => {
      await withQueryMonitoring(
        "SELECT * FROM users WHERE name LIKE '%test%'",
        async () => {
          const start = Date.now();
          while (Date.now() - start < 15) { /* spin */ }
          return null;
        },
        { slowQueryThreshold: 1, sampleRate: 1, maxQueryLength: 1000 },
      );
      const logs = getRecentSlowQueries(1);
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].recommendation).toContain('full-text search');
    });

    it('generates recommendation for slow JOIN queries', async () => {
      await withQueryMonitoring(
        'SELECT * FROM a JOIN b ON a.id = b.a_id',
        async () => {
          const start = Date.now();
          while (Date.now() - start < 510) { /* spin */ }
          return null;
        },
        { slowQueryThreshold: 1, sampleRate: 1, maxQueryLength: 1000 },
      );
      const logs = getRecentSlowQueries(1);
      expect(logs[0].recommendation).toContain('join columns');
    });

    it('generates recommendation for slow COUNT(*) queries', async () => {
      await withQueryMonitoring(
        'SELECT COUNT(*) FROM large_table',
        async () => {
          const start = Date.now();
          while (Date.now() - start < 210) { /* spin */ }
          return null;
        },
        { slowQueryThreshold: 1, sampleRate: 1, maxQueryLength: 1000 },
      );
      const logs = getRecentSlowQueries(1);
      expect(logs[0].recommendation).toContain('approximate count');
    });

    it('generates recommendation for slow ORDER BY queries', async () => {
      await withQueryMonitoring(
        'SELECT * FROM data ORDER BY created_at',
        async () => {
          const start = Date.now();
          while (Date.now() - start < 310) { /* spin */ }
          return null;
        },
        { slowQueryThreshold: 1, sampleRate: 1, maxQueryLength: 1000 },
      );
      const logs = getRecentSlowQueries(1);
      expect(logs[0].recommendation).toContain('ORDER BY');
    });

    it('generates recommendation for queries over 1 second', async () => {
      await withQueryMonitoring(
        'SELECT something',
        async () => {
          const start = Date.now();
          while (Date.now() - start < 1010) { /* spin */ }
          return null;
        },
        { slowQueryThreshold: 1, sampleRate: 1, maxQueryLength: 1000 },
      );
      const logs = getRecentSlowQueries(1);
      expect(logs[0].recommendation).toContain('exceeds 1 second');
    });

    it('generates EXPLAIN ANALYZE recommendation for generic slow queries', async () => {
      await withQueryMonitoring(
        'simpleQuery',
        async () => {
          const start = Date.now();
          while (Date.now() - start < 15) { /* spin */ }
          return null;
        },
        { slowQueryThreshold: 1, sampleRate: 1 },
      );
      const logs = getRecentSlowQueries(1);
      expect(logs[0].recommendation).toContain('EXPLAIN ANALYZE');
    });
  });
});
