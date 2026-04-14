import { beforeEach, describe, expect, it, vi } from 'vitest'

const executeMock = vi.fn(async (query: unknown) => {
  const text = String(query)

  if (text.includes('FROM pilot_alerts') && text.includes('detected_at >=')) {
    return [
      {
        severity: 'critical',
        status: 'resolved',
        detectedAt: '2026-04-14T10:00:00.000Z',
        acknowledgedAt: '2026-04-14T10:05:00.000Z',
        resolvedAt: '2026-04-14T10:25:00.000Z',
      },
      {
        severity: 'warning',
        status: 'acknowledged',
        detectedAt: '2026-04-14T11:00:00.000Z',
        acknowledgedAt: '2026-04-14T11:20:00.000Z',
        resolvedAt: null,
      },
    ]
  }

  return []
})

vi.mock('@nzila/db/platform', () => ({
  platformDb: {
    execute: executeMock,
  },
}))

import { __test__, computeAlertOpsMetrics } from './service'

describe('pilot alerting unit behavior', () => {
  beforeEach(() => {
    executeMock.mockClear()
  })

  it('builds deterministic dedup keys by metric and window bucket', () => {
    const bucket = __test__.dedupWindowBucket(new Date('2026-04-14T10:31:12.000Z'), 30)
    const key = __test__.buildDedupKey('error_rate', bucket)

    expect(key).toContain('error_rate:')
    expect(bucket.length).toBeGreaterThan(0)
  })

  it('correlates reliability incidents into one thread id', () => {
    const breaches = new Set(['error_rate', 'integration_failures'])
    const correlation = __test__.computeCorrelationId('error_rate', '12345', breaches)
    expect(correlation).toBe('reliability:12345')
  })

  it('supports threshold/rate/inactivity/anomaly rule evaluation', () => {
    const threshold = __test__.evaluateRuleBreach(
      {
        id: '11111111-1111-1111-1111-111111111111',
        orgId: '11111111-1111-1111-1111-111111111111',
        pilotId: '22222222-2222-2222-2222-222222222222',
        metricName: 'error_rate',
        ruleType: 'threshold',
        operator: '>',
        thresholdValue: 5,
        windowMinutes: 30,
        severity: 'critical',
        enabled: true,
        cooldownMinutes: 10,
        playbookKey: 'integration_dlq',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      7,
      [4, 5, 7],
    )
    expect(threshold.breached).toBe(true)

    const rate = __test__.evaluateRuleBreach(
      {
        id: '11111111-1111-1111-1111-111111111111',
        orgId: '11111111-1111-1111-1111-111111111111',
        pilotId: '22222222-2222-2222-2222-222222222222',
        metricName: 'sla_breach_count',
        ruleType: 'rate',
        operator: '>',
        thresholdValue: 10,
        windowMinutes: 60,
        severity: 'critical',
        enabled: true,
        cooldownMinutes: 15,
        playbookKey: 'sla_breach_spike',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      13,
      [11, 12, 13],
    )
    expect(rate.breached).toBe(true)

    const inactivity = __test__.evaluateRuleBreach(
      {
        id: '11111111-1111-1111-1111-111111111111',
        orgId: '11111111-1111-1111-1111-111111111111',
        pilotId: '22222222-2222-2222-2222-222222222222',
        metricName: 'events_created',
        ruleType: 'inactivity',
        operator: '<',
        thresholdValue: 1,
        windowMinutes: 1440,
        severity: 'info',
        enabled: true,
        cooldownMinutes: 60,
        playbookKey: 'adoption_low',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      0,
      [0, 0, 0],
    )
    expect(inactivity.breached).toBe(true)

    const anomaly = __test__.evaluateRuleBreach(
      {
        id: '11111111-1111-1111-1111-111111111111',
        orgId: '11111111-1111-1111-1111-111111111111',
        pilotId: '22222222-2222-2222-2222-222222222222',
        metricName: 'gross_revenue',
        ruleType: 'anomaly',
        operator: '<',
        thresholdValue: 30,
        windowMinutes: 180,
        severity: 'warning',
        enabled: true,
        cooldownMinutes: 30,
        playbookKey: 'revenue_drop',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      60,
      [100, 110, 60],
    )
    expect(anomaly.breached).toBe(true)
  })

  it('computes MTTA and MTTR from alert lifecycle rows', async () => {
    const result = await computeAlertOpsMetrics(
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
      30,
    )

    expect(result.mttaMinutes).toBeGreaterThan(0)
    expect(result.mttrMinutes).toBeGreaterThan(0)
    expect(result.bySeverity.critical.resolvedCount).toBe(1)
  })
})
