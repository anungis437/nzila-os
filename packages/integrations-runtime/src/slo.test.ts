import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SloComputer, type SloComputerPorts } from './slo'
import type { ProviderMetricsWindow, SloTarget } from '@nzila/integrations-db'

function makeMetricsWindow(overrides?: Partial<ProviderMetricsWindow>): ProviderMetricsWindow {
  return {
    id: 'mw-1',
    orgId: 'org-1',
    provider: 'resend',
    windowStart: '2026-02-27T11:00:00.000Z',
    windowEnd: '2026-02-27T12:00:00.000Z',
    sentCount: 100,
    successCount: 99,
    failureCount: 1,
    p50LatencyMs: 50,
    p95LatencyMs: 150,
    p99LatencyMs: 300,
    rateLimitedCount: 0,
    timeoutCount: 0,
    createdAt: '2026-02-27T12:00:00.000Z',
    ...overrides,
  }
}

function makeSloTarget(overrides?: Partial<SloTarget>): SloTarget {
  return {
    id: 'slo-1',
    orgId: null,
    provider: 'resend',
    channel: null,
    successRateTarget: 0.99,
    p95LatencyTarget: 5000,
    windowDays: 30,
    isDefault: true,
    metadata: {},
    createdAt: '2026-02-27T00:00:00.000Z',
    updatedAt: '2026-02-27T00:00:00.000Z',
    ...overrides,
  }
}

function makePorts(overrides?: Partial<SloComputerPorts>): SloComputerPorts {
  return {
    metricsRepo: {
      recordMetrics: vi.fn(),
      queryByOrgAndProvider: vi.fn().mockResolvedValue([makeMetricsWindow()]),
      latestByOrgAndProvider: vi.fn().mockResolvedValue(null),
      aggregateByOrg: vi.fn().mockResolvedValue([]),
    },
    sloTargetRepo: {
      upsert: vi.fn(),
      findForOrgAndProvider: vi.fn().mockResolvedValue(null),
      findDefault: vi.fn().mockResolvedValue(makeSloTarget()),
      listByOrg: vi.fn().mockResolvedValue([]),
      listDefaults: vi.fn().mockResolvedValue([]),
    },
    emitAudit: vi.fn(),
    ...overrides,
  }
}

describe('SloComputer', () => {
  let ports: SloComputerPorts
  let slo: SloComputer

  beforeEach(() => {
    ports = makePorts()
    slo = new SloComputer(ports)
  })

  it('computes compliant SLO when metrics meet target', async () => {
    const result = await slo.compute('org-1', 'resend')

    expect(result.availability).toBe(0.99)
    expect(result.errorRate).toBeCloseTo(0.01)
    expect(result.p95LatencyMs).toBe(150)
    expect(result.availabilityMet).toBe(true)
    expect(result.latencyMet).toBe(true)
    expect(result.compliant).toBe(true)
    expect(ports.emitAudit).not.toHaveBeenCalled()
  })

  it('detects availability breach and emits audit', async () => {
    ports = makePorts({
      metricsRepo: {
        ...makePorts().metricsRepo,
        queryByOrgAndProvider: vi.fn().mockResolvedValue([
          makeMetricsWindow({ sentCount: 100, successCount: 95, failureCount: 5 }),
        ]),
      },
    })
    slo = new SloComputer(ports)

    const result = await slo.compute('org-1', 'resend')

    expect(result.availability).toBe(0.95)
    expect(result.availabilityMet).toBe(false)
    expect(result.compliant).toBe(false)
    expect(ports.emitAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'integration.sla.breach',
        details: expect.objectContaining({ metric: 'availability' }),
      }),
    )
  })

  it('detects latency breach and emits audit', async () => {
    ports = makePorts({
      metricsRepo: {
        ...makePorts().metricsRepo,
        queryByOrgAndProvider: vi.fn().mockResolvedValue([
          makeMetricsWindow({ p95LatencyMs: 6000 }),
        ]),
      },
    })
    slo = new SloComputer(ports)

    const result = await slo.compute('org-1', 'resend')

    expect(result.latencyMet).toBe(false)
    expect(result.compliant).toBe(false)
    expect(ports.emitAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'integration.sla.breach',
        details: expect.objectContaining({ metric: 'latency' }),
      }),
    )
  })

  it('uses org-specific target when available', async () => {
    const orgTarget = makeSloTarget({ orgId: 'org-1', successRateTarget: 0.95, isDefault: false })
    ports = makePorts({
      sloTargetRepo: {
        ...makePorts().sloTargetRepo,
        findForOrgAndProvider: vi.fn().mockResolvedValue(orgTarget),
      },
      metricsRepo: {
        ...makePorts().metricsRepo,
        queryByOrgAndProvider: vi.fn().mockResolvedValue([
          makeMetricsWindow({ sentCount: 100, successCount: 96, failureCount: 4 }),
        ]),
      },
    })
    slo = new SloComputer(ports)

    const result = await slo.compute('org-1', 'resend')

    expect(result.availability).toBe(0.96)
    expect(result.availabilityMet).toBe(true) // 96% > 95% target
    expect(result.target?.orgId).toBe('org-1')
  })

  it('returns compliant when no metrics exist', async () => {
    ports = makePorts({
      metricsRepo: {
        ...makePorts().metricsRepo,
        queryByOrgAndProvider: vi.fn().mockResolvedValue([]),
      },
    })
    slo = new SloComputer(ports)

    const result = await slo.compute('org-1', 'resend')

    expect(result.availability).toBe(1)
    expect(result.errorRate).toBe(0)
    expect(result.compliant).toBe(true)
  })

  it('aggregates multiple windows correctly', async () => {
    ports = makePorts({
      metricsRepo: {
        ...makePorts().metricsRepo,
        queryByOrgAndProvider: vi.fn().mockResolvedValue([
          makeMetricsWindow({ sentCount: 50, successCount: 49, failureCount: 1, p95LatencyMs: 100 }),
          makeMetricsWindow({ sentCount: 50, successCount: 48, failureCount: 2, p95LatencyMs: 200 }),
        ]),
      },
    })
    slo = new SloComputer(ports)

    const result = await slo.compute('org-1', 'resend')

    expect(result.sentCount).toBe(100)
    expect(result.failureCount).toBe(3)
    expect(result.availability).toBe(0.97)
    expect(result.p95LatencyMs).toBe(200) // max across windows
  })

  it('exportReport includes all providers and overall compliance', async () => {
    const report = await slo.exportReport('org-1')

    expect(report.orgId).toBe('org-1')
    expect(report.results).toHaveLength(8)
    expect(report).toHaveProperty('generatedAt')
    expect(report).toHaveProperty('breaches')
    expect(report).toHaveProperty('compliant')
  })
})
