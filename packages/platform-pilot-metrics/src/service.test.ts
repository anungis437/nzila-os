import { describe, expect, it } from 'vitest'
import { __test__ } from './service'

describe('platform-pilot-metrics scoring helpers', () => {
  it('clamps scores between 0 and 100', () => {
    expect(__test__.clampScore(-50)).toBe(0)
    expect(__test__.clampScore(250)).toBe(100)
    expect(__test__.clampScore(82.4)).toBe(82)
  })

  it('scores positively and negatively based on metric direction', () => {
    const high = __test__.scoreFromMetric(
      { daily_active_users: 60, error_rate: 0 },
      ['daily_active_users'],
      ['error_rate'],
    )
    const low = __test__.scoreFromMetric(
      { daily_active_users: 0, error_rate: 20 },
      ['daily_active_users'],
      ['error_rate'],
    )

    expect(high).toBeGreaterThan(low)
  })

  it('builds bounded rollup windows', () => {
    const w = __test__.buildWindow('day', new Date('2026-04-14T10:30:00.000Z'))
    expect(w.start).toContain('T00:00:00.000Z')
    expect(new Date(w.end).getTime()).toBeGreaterThanOrEqual(new Date(w.start).getTime())
  })

  it('aggregates UE response/resolution/sla/workflow metrics with defensible math', () => {
    const aggregated = __test__.aggregateMetricEvents([
      {
        metricName: 'cases_created',
        valueNumeric: 1,
        valueJson: null,
        appScope: 'union-eyes',
      },
      {
        metricName: 'cases_acknowledged',
        valueNumeric: 1,
        valueJson: null,
        appScope: 'union-eyes',
      },
      {
        metricName: 'avg_time_to_first_response',
        valueNumeric: 30,
        valueJson: { numeratorMinutes: 30, denominator: 1 },
        appScope: 'union-eyes',
      },
      {
        metricName: 'avg_time_to_first_response',
        valueNumeric: 90,
        valueJson: { numeratorMinutes: 180, denominator: 2 },
        appScope: 'union-eyes',
      },
      {
        metricName: 'avg_time_to_resolution',
        valueNumeric: 24,
        valueJson: { numeratorHours: 48, denominator: 2 },
        appScope: 'union-eyes',
      },
      {
        metricName: 'workflow_transition_success_rate',
        valueNumeric: 1,
        valueJson: null,
        appScope: 'union-eyes',
      },
      {
        metricName: 'workflow_transition_success_rate',
        valueNumeric: 0,
        valueJson: null,
        appScope: 'union-eyes',
      },
      {
        metricName: 'sla_compliance_rate',
        valueNumeric: 0,
        valueJson: { compliantCount: 9, totalScanned: 10 },
        appScope: 'union-eyes',
      },
      {
        metricName: 'sla_compliance_rate',
        valueNumeric: 0,
        valueJson: { compliantCount: 3, totalScanned: 5 },
        appScope: 'union-eyes',
      },
    ])

    expect(aggregated.get('cases_created')?.valueNumeric).toBe(1)
    expect(aggregated.get('cases_acknowledged')?.valueNumeric).toBe(1)
    expect(aggregated.get('avg_time_to_first_response')?.valueNumeric).toBe(70)
    expect(aggregated.get('avg_time_to_resolution')?.valueNumeric).toBe(24)
    expect(aggregated.get('workflow_transition_success_rate')?.valueNumeric).toBe(50)
    expect(aggregated.get('sla_compliance_rate')?.valueNumeric).toBe(80)
  })

  it('aggregates Zonga watch/replay/revenue inputs from real metric events', () => {
    const aggregated = __test__.aggregateMetricEvents([
      {
        metricName: 'tickets_sold',
        valueNumeric: 2,
        valueJson: null,
        appScope: 'zonga',
      },
      {
        metricName: 'attendee_checkins',
        valueNumeric: 2,
        valueJson: null,
        appScope: 'zonga',
      },
      {
        metricName: 'stream_starts',
        valueNumeric: 3,
        valueJson: null,
        appScope: 'zonga',
      },
      {
        metricName: 'stream_watch_minutes',
        valueNumeric: 12,
        valueJson: { durationMs: 720000, denominator: 1 },
        appScope: 'zonga',
      },
      {
        metricName: 'stream_watch_minutes',
        valueNumeric: 18,
        valueJson: { durationMs: 1080000, denominator: 1 },
        appScope: 'zonga',
      },
      {
        metricName: 'avg_watch_time',
        valueNumeric: 12,
        valueJson: { durationMs: 720000, denominator: 1 },
        appScope: 'zonga',
      },
      {
        metricName: 'avg_watch_time',
        valueNumeric: 18,
        valueJson: { durationMs: 1080000, denominator: 1 },
        appScope: 'zonga',
      },
      {
        metricName: 'replay_views',
        valueNumeric: 1,
        valueJson: null,
        appScope: 'zonga',
      },
      {
        metricName: 'platform_fee_revenue',
        valueNumeric: 12.5,
        valueJson: null,
        appScope: 'zonga',
      },
      {
        metricName: 'creator_payouts',
        valueNumeric: 45,
        valueJson: null,
        appScope: 'zonga',
      },
      {
        metricName: 'payout_volume',
        valueNumeric: 45,
        valueJson: null,
        appScope: 'zonga',
      },
    ])

    expect(aggregated.get('tickets_sold')?.valueNumeric).toBe(2)
    expect(aggregated.get('attendee_checkins')?.valueNumeric).toBe(2)
    expect(aggregated.get('stream_starts')?.valueNumeric).toBe(3)
    expect(aggregated.get('stream_watch_minutes')?.valueNumeric).toBe(30)
    expect(aggregated.get('avg_watch_time')?.valueNumeric).toBe(15)
    expect(aggregated.get('replay_views')?.valueNumeric).toBe(1)
    expect(aggregated.get('platform_fee_revenue')?.valueNumeric).toBe(12.5)
    expect(aggregated.get('creator_payouts')?.valueNumeric).toBe(45)
    expect(aggregated.get('payout_volume')?.valueNumeric).toBe(45)
  })

  it('builds dedup keys and reliability correlation ids for alert threads', () => {
    const bucket = __test__.dedupWindowBucket(new Date('2026-04-14T10:30:00.000Z'), 30)
    const key = __test__.buildDedupKey('error_rate', bucket)
    const corr = __test__.computeCorrelationId('error_rate', bucket, new Set(['error_rate', 'integration_failures']))

    expect(key).toContain('error_rate:')
    expect(corr).toContain('reliability:')
  })

  it('evaluates threshold/rate/inactivity/anomaly rules to reduce alert noise', () => {
    const now = new Date().toISOString()
    const threshold = __test__.evaluateRuleBreach({
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
      cooldownMinutes: 15,
      playbookKey: 'integration_dlq',
      createdAt: now,
      updatedAt: now,
    }, 8, [4, 8])

    const rate = __test__.evaluateRuleBreach({
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
      cooldownMinutes: 20,
      playbookKey: 'sla_breach_spike',
      createdAt: now,
      updatedAt: now,
    }, 12, [11, 12, 13])

    const inactivity = __test__.evaluateRuleBreach({
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
      createdAt: now,
      updatedAt: now,
    }, 0, [0, 0, 0])

    const anomaly = __test__.evaluateRuleBreach({
      id: '11111111-1111-1111-1111-111111111111',
      orgId: '11111111-1111-1111-1111-111111111111',
      pilotId: '22222222-2222-2222-2222-222222222222',
      metricName: 'gross_revenue',
      ruleType: 'anomaly',
      operator: '<',
      thresholdValue: 25,
      windowMinutes: 180,
      severity: 'warning',
      enabled: true,
      cooldownMinutes: 45,
      playbookKey: 'revenue_drop',
      createdAt: now,
      updatedAt: now,
    }, 60, [110, 100, 60])

    expect(threshold.breached).toBe(true)
    expect(rate.breached).toBe(true)
    expect(inactivity.breached).toBe(true)
    expect(anomaly.breached).toBe(true)
  })
})
