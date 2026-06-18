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
    mockHgetall: vi.fn(),
    mockScard: vi.fn(),
    mockDel: vi.fn(),
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
    hgetall = mocks.mockHgetall;
    scard = mocks.mockScard;
    del = mocks.mockDel;
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

import { performanceMonitor, withPerformanceTracking, getPerformanceMetrics } from '../analytics-performance';

describe('RedisAnalyticsPerformanceMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('recordQuery executes pipeline', async () => {
    await performanceMonitor.recordQuery('claims', 200, false, 'org-1');
    expect(mocks.mockPipelineExec).toHaveBeenCalled();
  });

  it('recordQuery logs slow query and increments pipeline calls', async () => {
    await performanceMonitor.recordQuery('slow-ep', 2000, false, 'org-1');
    expect(mocks.mockPipelineExec).toHaveBeenCalled();
  });

  it('recordQuery with cached=true pipeline succeeds', async () => {
    await performanceMonitor.recordQuery('ep', 50, true, 'org-2');
    expect(mocks.mockPipelineExec).toHaveBeenCalled();
  });

  it('recordQuery swallows pipeline error', async () => {
    mocks.mockPipelineExec.mockRejectedValue(new Error('redis fail'));
    await expect(performanceMonitor.recordQuery('ep', 100, false, 'org-1')).resolves.toBeUndefined();
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

  it('getEndpointReport filters invalid JSON', async () => {
    mocks.mockZrange.mockResolvedValue(['not-json', JSON.stringify({ endpoint: 'x', duration: 100, cached: false, organizationId: 'y' })]);
    const report = await performanceMonitor.getEndpointReport('x');
    expect(report).not.toBeNull();
    expect(report!.totalCalls).toBe(1);
  });

  it('getEndpointReport returns null for no data', async () => {
    mocks.mockZrange.mockResolvedValue([]);
    const report = await performanceMonitor.getEndpointReport('empty');
    expect(report).toBeNull();
  });

  it('getEndpointReport returns null on error', async () => {
    mocks.mockZrange.mockRejectedValue(new Error('redis fail'));
    expect(await performanceMonitor.getEndpointReport('ep')).toBeNull();
  });

  it('getSlowQueries returns parsed slow queries with Date timestamp', async () => {
    mocks.mockZrange.mockResolvedValue([
      JSON.stringify({ endpoint: 'slow', duration: 5000, timestamp: Date.now() }),
    ]);

    const queries = await performanceMonitor.getSlowQueries(5);
    expect(queries).toHaveLength(1);
    expect(queries[0].duration).toBe(5000);
    expect(queries[0].timestamp).toBeInstanceOf(Date);
  });

  it('getSlowQueries returns empty on no data', async () => {
    mocks.mockZrange.mockResolvedValue([]);
    expect(await performanceMonitor.getSlowQueries()).toHaveLength(0);
  });

  it('getSlowQueries filters invalid JSON', async () => {
    mocks.mockZrange.mockResolvedValue(['bad', JSON.stringify({ endpoint: 'x', duration: 1500, timestamp: Date.now() })]);
    expect(await performanceMonitor.getSlowQueries(10)).toHaveLength(1);
  });

  it('getSlowQueries returns empty on error', async () => {
    mocks.mockZrange.mockRejectedValue(new Error('fail'));
    expect(await performanceMonitor.getSlowQueries()).toHaveLength(0);
  });

  it('getAllReports returns sorted reports', async () => {
    mocks.mockSmembers.mockResolvedValue(['a', 'b']);
    mocks.mockZrange
      .mockResolvedValueOnce([JSON.stringify({ endpoint: 'a', duration: 100, cached: false, organizationId: 'x' })])
      .mockResolvedValueOnce([JSON.stringify({ endpoint: 'b', duration: 500, cached: true, organizationId: 'x' })]);

    const reports = await performanceMonitor.getAllReports();
    expect(reports).toHaveLength(2);
    expect(reports[0].avgDuration).toBeGreaterThanOrEqual(reports[1].avgDuration);
  });

  it('getAllReports returns empty when no endpoints', async () => {
    mocks.mockSmembers.mockResolvedValue([]);
    expect(await performanceMonitor.getAllReports()).toHaveLength(0);
  });

  it('getAllReports returns empty on error', async () => {
    mocks.mockSmembers.mockRejectedValue(new Error('fail'));
    expect(await performanceMonitor.getAllReports()).toHaveLength(0);
  });

  it('getOrganizationMetrics returns metrics', async () => {
    mocks.mockZrange.mockResolvedValue([
      JSON.stringify({ endpoint: 'ep', duration: 100, cached: false, organizationId: 'org-1' }),
    ]);
    const result = await performanceMonitor.getOrganizationMetrics('org-1');
    expect(result).toHaveLength(1);
    expect(result[0].organizationId).toBe('org-1');
  });

  it('getOrganizationMetrics returns empty on no data', async () => {
    mocks.mockZrange.mockResolvedValue([]);
    expect(await performanceMonitor.getOrganizationMetrics('org-x')).toHaveLength(0);
  });

  it('getOrganizationMetrics filters invalid JSON', async () => {
    mocks.mockZrange.mockResolvedValue(['bad', JSON.stringify({ endpoint: 'e', duration: 10, cached: true, organizationId: 'o' })]);
    expect(await performanceMonitor.getOrganizationMetrics('o')).toHaveLength(1);
  });

  it('getOrganizationMetrics returns empty on error', async () => {
    mocks.mockZrange.mockRejectedValue(new Error('fail'));
    expect(await performanceMonitor.getOrganizationMetrics('o')).toHaveLength(0);
  });

  it('getSummary returns null when no data', async () => {
    mocks.mockHgetall.mockResolvedValue(null);
    mocks.mockScard.mockResolvedValue(0);
    expect(await performanceMonitor.getSummary()).toBeNull();
  });

  it('getSummary returns null when totalQueries missing', async () => {
    mocks.mockHgetall.mockResolvedValue({});
    mocks.mockScard.mockResolvedValue(0);
    expect(await performanceMonitor.getSummary()).toBeNull();
  });

  it('getSummary returns computed summary', async () => {
    mocks.mockHgetall.mockResolvedValue({ totalQueries: '10', totalDuration: '2000', cachedQueries: '4', slowQueries: '1' });
    mocks.mockScard.mockResolvedValueOnce(3).mockResolvedValueOnce(2);
    const summary = await performanceMonitor.getSummary();
    expect(summary).not.toBeNull();
    expect(summary!.totalQueries).toBe(10);
    expect(summary!.avgDuration).toBe(200);
    expect(summary!.cacheHitRate).toBeCloseTo(0.4);
    expect(summary!.uniqueEndpoints).toBe(3);
    expect(summary!.uniqueOrganizations).toBe(2);
  });

  it('getSummary returns null on error', async () => {
    mocks.mockHgetall.mockRejectedValue(new Error('fail'));
    expect(await performanceMonitor.getSummary()).toBeNull();
  });

  it('exportMetrics returns all sections', async () => {
    mocks.mockHgetall.mockResolvedValue(null);
    mocks.mockScard.mockResolvedValue(0);
    mocks.mockSmembers.mockResolvedValue([]);
    mocks.mockZrange.mockResolvedValue([]);
    const result = await performanceMonitor.exportMetrics();
    expect(result).toHaveProperty('enabled');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('endpointReports');
    expect(result).toHaveProperty('slowQueries');
    expect(result).toHaveProperty('retentionDays');
  });

  it('clearMetrics deletes all keys', async () => {
    mocks.mockSmembers.mockResolvedValueOnce(['ep1']).mockResolvedValueOnce(['org-1']);
    mocks.mockDel.mockResolvedValue(1);
    await expect(performanceMonitor.clearMetrics('2024-01-01')).resolves.toBeUndefined();
    expect(mocks.mockDel).toHaveBeenCalled();
  });

  it('clearMetrics swallows error', async () => {
    mocks.mockSmembers.mockRejectedValue(new Error('fail'));
    await expect(performanceMonitor.clearMetrics('2024-01-01')).resolves.toBeUndefined();
  });
});

describe('withPerformanceTracking', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns query result and records metric', async () => {
    mocks.mockPipelineExec.mockResolvedValue([]);
    const result = await withPerformanceTracking('ep', 'org-1', false, async () => 42);
    expect(result).toBe(42);
  });

  it('records metric failure swallowed on success path', async () => {
    mocks.mockPipelineExec.mockRejectedValue(new Error('redis fail'));
    await expect(withPerformanceTracking('ep', 'org-1', false, async () => 'ok')).resolves.toBe('ok');
    await new Promise(r => setTimeout(r, 0)); // flush fire-and-forget .catch()
  });

  it('records metric and rethrows on query error', async () => {
    mocks.mockPipelineExec.mockResolvedValue([]);
    await expect(
      withPerformanceTracking('ep', 'org-1', false, async () => { throw new Error('query fail'); })
    ).rejects.toThrow('query fail');
  });

  it('records metric failure swallowed on error path', async () => {
    mocks.mockPipelineExec.mockRejectedValue(new Error('redis fail'));
    await expect(
      withPerformanceTracking('ep', 'org-1', false, async () => { throw new Error('query fail'); })
    ).rejects.toThrow('query fail');
    await new Promise(r => setTimeout(r, 0)); // flush fire-and-forget .catch()
  });
});

describe('getPerformanceMetrics', () => {
  it('delegates to exportMetrics', async () => {
    mocks.mockHgetall.mockResolvedValue(null);
    mocks.mockScard.mockResolvedValue(0);
    mocks.mockSmembers.mockResolvedValue([]);
    mocks.mockZrange.mockResolvedValue([]);
    const result = await getPerformanceMetrics();
    expect(result).toHaveProperty('enabled');
  });
});

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
