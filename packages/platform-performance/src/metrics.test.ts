import { describe, it, expect, vi } from 'vitest'
import { computeEnvelope } from './metrics'

// ── Mock DB layer ──────────────────────────────────────────────────────────

vi.mock('@nzila/db/platform', () => ({
  platformDb: {
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock('@nzila/db/schema', () => ({
  platformRequestMetrics: {
    route: 'route',
    entityId: 'entity_id',
    latencyMs: 'latency_ms',
    statusCode: 'status_code',
    recordedAt: 'recorded_at',
    id: 'id',
  },
}))

// ── Type contract tests ────────────────────────────────────────────────────

describe('Platform Performance — type contracts', () => {
  it('exports trackRequestMetrics', async () => {
    const mod = await import('./metrics')
    expect(typeof mod.trackRequestMetrics).toBe('function')
  })

  it('exports getPerformanceEnvelope', async () => {
    const mod = await import('./metrics')
    expect(typeof mod.getPerformanceEnvelope).toBe('function')
  })

  it('exports getGlobalPerformanceEnvelope', async () => {
    const mod = await import('./metrics')
    expect(typeof mod.getGlobalPerformanceEnvelope).toBe('function')
  })
})

// ── Envelope computation tests ──────────────────────────────────────────────

describe('computeEnvelope — deterministic percentile calculation', () => {
  const now = new Date()

  it('returns zeroes for empty input', () => {
    const result = computeEnvelope([], 60)
    expect(result.p50).toBe(0)
    expect(result.p95).toBe(0)
    expect(result.p99).toBe(0)
    expect(result.errorRate).toBe(0)
    expect(result.throughput).toBe(0)
    expect(result.sampleSize).toBe(0)
  })

  it('computes correct P50 for odd-count data', () => {
    const rows = [10, 20, 30, 40, 50].map((ms) => ({
      route: '/api/test',
      latencyMs: ms,
      statusCode: 200,
      recordedAt: now,
    }))
    const result = computeEnvelope(rows, 60)
    expect(result.p50).toBe(30)
  })

  it('computes correct P95/P99 for 100 data points', () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({
      route: '/api/test',
      latencyMs: i + 1,
      statusCode: 200,
      recordedAt: now,
    }))
    const result = computeEnvelope(rows, 60)
    expect(result.p50).toBe(50)
    expect(result.p95).toBe(95)
    expect(result.p99).toBe(99)
  })

  it('calculates error rate correctly', () => {
    const rows = [
      { route: '/api/a', latencyMs: 10, statusCode: 200, recordedAt: now },
      { route: '/api/a', latencyMs: 20, statusCode: 500, recordedAt: now },
      { route: '/api/a', latencyMs: 30, statusCode: 400, recordedAt: now },
      { route: '/api/a', latencyMs: 40, statusCode: 200, recordedAt: now },
    ]
    const result = computeEnvelope(rows, 60)
    expect(result.errorRate).toBe(50)
  })

  it('calculates throughput as requests per minute', () => {
    const rows = Array.from({ length: 120 }, () => ({
      route: '/api/test',
      latencyMs: 10,
      statusCode: 200,
      recordedAt: now,
    }))
    const result = computeEnvelope(rows, 60)
    expect(result.throughput).toBe(2)
  })

  it('provides per-app breakdown', () => {
    const rows = [
      { route: '/api/claims', latencyMs: 10, statusCode: 200, recordedAt: now },
      { route: '/api/claims', latencyMs: 20, statusCode: 200, recordedAt: now },
      { route: '/api/revenue', latencyMs: 50, statusCode: 500, recordedAt: now },
    ]
    const result = computeEnvelope(rows, 60)
    expect(result.perApp).toHaveLength(2)
    const claims = result.perApp.find((a) => a.route === '/api/claims')
    expect(claims?.requestCount).toBe(2)
    expect(claims?.avgLatencyMs).toBe(15)
    expect(claims?.errorRate).toBe(0)

    const revenue = result.perApp.find((a) => a.route === '/api/revenue')
    expect(revenue?.errorRate).toBe(100)
  })

  it('handles single data point', () => {
    const rows = [{ route: '/api/test', latencyMs: 42, statusCode: 200, recordedAt: now }]
    const result = computeEnvelope(rows, 60)
    expect(result.p50).toBe(42)
    expect(result.p95).toBe(42)
    expect(result.p99).toBe(42)
    expect(result.sampleSize).toBe(1)
  })
})
