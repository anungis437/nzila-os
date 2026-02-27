import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MetricsCollector, computePercentile, type DeliveryMetricEvent, type MetricsCollectorPorts } from './metrics'

function makePorts(overrides?: Partial<MetricsCollectorPorts>): MetricsCollectorPorts {
  return {
    metricsRepo: {
      recordMetrics: vi.fn().mockResolvedValue({ id: 'met-1' }),
      queryByOrgAndProvider: vi.fn().mockResolvedValue([]),
      latestByOrgAndProvider: vi.fn().mockResolvedValue(null),
      aggregateByOrg: vi.fn().mockResolvedValue([]),
    },
    healthRepo: {
      upsert: vi.fn().mockResolvedValue({
        id: 'h-1',
        orgId: 'org-1',
        provider: 'resend',
        status: 'ok',
        consecutiveFailures: 0,
        circuitState: 'closed',
        lastCheckedAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        circuitOpenedAt: null,
        circuitNextRetryAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      findByOrgAndProvider: vi.fn().mockResolvedValue(null),
      listByOrg: vi.fn().mockResolvedValue([]),
      listAll: vi.fn().mockResolvedValue([]),
      updateCircuitState: vi.fn().mockResolvedValue(null),
    },
    emitAudit: vi.fn(),
    ...overrides,
  }
}

const baseEvent: DeliveryMetricEvent = {
  orgId: 'org-1',
  provider: 'resend',
  success: true,
  latencyMs: 100,
  rateLimited: false,
  timedOut: false,
  timestamp: '2026-02-27T12:00:00.000Z',
}

describe('computePercentile', () => {
  it('returns 0 for empty array', () => {
    expect(computePercentile([], 95)).toBe(0)
  })

  it('returns correct p50 for sorted array', () => {
    expect(computePercentile([10, 20, 30, 40, 50], 50)).toBe(30)
  })

  it('returns correct p95 for sorted array', () => {
    const arr = Array.from({ length: 100 }, (_, i) => i + 1)
    expect(computePercentile(arr, 95)).toBe(95)
  })

  it('returns correct p99 for sorted array', () => {
    const arr = Array.from({ length: 100 }, (_, i) => i + 1)
    expect(computePercentile(arr, 99)).toBe(99)
  })
})

describe('MetricsCollector', () => {
  let ports: MetricsCollectorPorts
  let collector: MetricsCollector

  beforeEach(() => {
    ports = makePorts()
    collector = new MetricsCollector(ports)
  })

  it('records a metric event into buffers', () => {
    collector.record(baseEvent)
    // No flush should have happened yet
    expect(ports.metricsRepo.recordMetrics).not.toHaveBeenCalled()
  })

  it('flushAll writes aggregated metrics to repo', async () => {
    collector.record(baseEvent)
    collector.record({ ...baseEvent, success: false, latencyMs: 200 })
    collector.record({ ...baseEvent, latencyMs: 50, rateLimited: true })

    await collector.flushAll()

    // Should have flushed 2 windows (5m + 1h)
    expect(ports.metricsRepo.recordMetrics).toHaveBeenCalledTimes(2)
    const call = vi.mocked(ports.metricsRepo.recordMetrics).mock.calls[0]?.[0]
    expect(call).toBeDefined()
    expect(call?.sentCount).toBe(3)
    expect(call?.successCount).toBe(2)
    expect(call?.failureCount).toBe(1)
    expect(call?.rateLimitedCount).toBe(1)
  })

  it('reports correct latency percentiles on flush', async () => {
    // Record latencies: 50, 100, 200
    collector.record({ ...baseEvent, latencyMs: 50 })
    collector.record({ ...baseEvent, latencyMs: 100 })
    collector.record({ ...baseEvent, latencyMs: 200 })

    await collector.flushAll()

    const call = vi.mocked(ports.metricsRepo.recordMetrics).mock.calls[0]?.[0]
    expect(call).toBeDefined()
    expect(call?.p50LatencyMs).toBe(100)
    expect(call?.p95LatencyMs).toBe(200)
    expect(call?.p99LatencyMs).toBe(200)
  })

  it('updateHealthSnapshot increments failure count on failure', async () => {
    const existingHealth = {
      id: 'h-1',
      orgId: 'org-1',
      provider: 'resend' as const,
      status: 'ok' as const,
      consecutiveFailures: 2,
      circuitState: 'closed' as const,
      lastCheckedAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      circuitOpenedAt: null,
      circuitNextRetryAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    ports = makePorts({
      healthRepo: {
        ...makePorts().healthRepo,
        findByOrgAndProvider: vi.fn().mockResolvedValue(existingHealth),
        upsert: vi.fn().mockResolvedValue({
          ...existingHealth,
          consecutiveFailures: 3,
          status: 'degraded',
        }),
      },
    })
    collector = new MetricsCollector(ports)

    const result = await collector.updateHealthSnapshot('org-1', 'resend', false, '500', 'Server Error')

    expect(result.consecutiveFailures).toBe(3)
    expect(result.status).toBe('degraded')
  })

  it('updateHealthSnapshot resets on success', async () => {
    const existingHealth = {
      id: 'h-1',
      orgId: 'org-1',
      provider: 'resend' as const,
      status: 'degraded' as const,
      consecutiveFailures: 3,
      circuitState: 'closed' as const,
      lastCheckedAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      circuitOpenedAt: null,
      circuitNextRetryAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    ports = makePorts({
      healthRepo: {
        ...makePorts().healthRepo,
        findByOrgAndProvider: vi.fn().mockResolvedValue(existingHealth),
        upsert: vi.fn().mockResolvedValue({
          ...existingHealth,
          consecutiveFailures: 0,
          status: 'ok',
        }),
      },
    })
    collector = new MetricsCollector(ports)

    const result = await collector.updateHealthSnapshot('org-1', 'resend', true)

    expect(result.consecutiveFailures).toBe(0)
    expect(result.status).toBe('ok')
  })
})
