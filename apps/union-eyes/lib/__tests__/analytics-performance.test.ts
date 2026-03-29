import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  // Set env vars before module import (hoisted runs first)
  process.env.UPSTASH_REDIS_REST_URL = 'https://fake.upstash.io';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';
  return {
    mockZadd: vi.fn(),
    mockExpire: vi.fn(),
    mockHincrby: vi.fn(),
    mockSadd: vi.fn(),
    mockZrange: vi.fn(),
    mockSmembers: vi.fn(),
    mockPipelineExec: vi.fn(),
    mockZremrangebyrank: vi.fn(),
  };
});

vi.mock('@upstash/redis', () => ({
  Redis: class {
    zadd = mocks.mockZadd;
    expire = mocks.mockExpire;
    hincrby = mocks.mockHincrby;
    sadd = mocks.mockSadd;
    zrange = mocks.mockZrange;
    smembers = mocks.mockSmembers;
    zremrangebyrank = mocks.mockZremrangebyrank;
    pipeline = vi.fn().mockReturnValue({
      zadd: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      hincrby: vi.fn().mockReturnThis(),
      sadd: vi.fn().mockReturnThis(),
      zremrangebyrank: vi.fn().mockReturnThis(),
      exec: mocks.mockPipelineExec.mockResolvedValue([]),
    });
  },
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { performanceMonitor } from '../analytics-performance';

describe('RedisAnalyticsPerformanceMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('recordQuery executes pipeline', async () => {
    await performanceMonitor.recordQuery('claims', 200, false, 'org-1');
    expect(mocks.mockPipelineExec).toHaveBeenCalled();
  });

  it('getEndpointReport returns parsed metrics', async () => {
    mocks.mockZrange.mockResolvedValue([
      JSON.stringify({ endpoint: 'claims', duration: 100, cached: false, organizationId: 'org-1' }),
      JSON.stringify({ endpoint: 'claims', duration: 200, cached: true, organizationId: 'org-1' }),
    ]);

    const report = await performanceMonitor.getEndpointReport('claims');
    expect(report).not.toBeNull();
    expect(report!.endpoint).toBe('claims');
    expect(report!.totalCalls).toBe(2);
    expect(report!.avgDuration).toBe(150);
  });

  it('getEndpointReport returns null for no data', async () => {
    mocks.mockZrange.mockResolvedValue([]);
    const report = await performanceMonitor.getEndpointReport('empty');
    expect(report).toBeNull();
  });

  it('getSlowQueries returns parsed slow queries', async () => {
    mocks.mockZrange.mockResolvedValue([
      JSON.stringify({ endpoint: 'slow', duration: 5000, timestamp: Date.now() }),
    ]);

    const queries = await performanceMonitor.getSlowQueries(5);
    expect(queries).toHaveLength(1);
    expect(queries[0].duration).toBe(5000);
  });

  it('getAllReports returns sorted reports', async () => {
    mocks.mockSmembers.mockResolvedValue(['a', 'b']);
    mocks.mockZrange
      .mockResolvedValueOnce([JSON.stringify({ endpoint: 'a', duration: 100, cached: false, organizationId: 'x' })])
      .mockResolvedValueOnce([JSON.stringify({ endpoint: 'b', duration: 500, cached: true, organizationId: 'x' })]);

    const reports = await performanceMonitor.getAllReports();
    expect(reports).toHaveLength(2);
    // Should be sorted by avgDuration desc
    expect(reports[0].avgDuration).toBeGreaterThanOrEqual(reports[1].avgDuration);
  });
});
