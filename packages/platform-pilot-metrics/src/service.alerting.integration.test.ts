import { beforeEach, describe, expect, it, vi } from 'vitest'

interface MemAlert {
  id: string
  orgId: string
  pilotId: string
  ruleId: string
  alertType: string
  severity: 'info' | 'warning' | 'critical'
  status: 'open' | 'acknowledged' | 'in_progress' | 'resolved' | 'auto_resolved'
  dedupKey: string
  correlationId: string | null
  title: string
  message: string
  whatHappened: string | null
  whyItMatters: string | null
  whatToDoNext: string | null
  playbookKey: string | null
  metricValue: number | null
  thresholdValue: number | null
  windowStart: string | null
  windowEnd: string | null
  occurrenceCount: number
  firstSeenAt: string
  lastSeenAt: string
  assigneeUserId: string | null
  acknowledgedBy: string | null
  acknowledgedAt: string | null
  resolvedBy: string | null
  resolutionNotes: string | null
  escalatedAt: string | null
  metricName: string | null
  detectedAt: string
  resolvedAt: string | null
  metadataJson: Record<string, unknown>
}

let memAlerts: MemAlert[] = []

const escalationPolicy = {
  id: '99999999-9999-9999-9999-999999999999',
  orgId: '11111111-1111-1111-1111-111111111111',
  pilotId: '22222222-2222-2222-2222-222222222222',
  severity: 'critical',
  notifyAfterMinutes: 0,
  escalationChannel: 'webhook',
  escalationTarget: 'webhook://default-critical',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const executeMock = vi.fn(async (query: unknown) => {
  const text = String(query)

  if (text.includes('FROM pilot_alerts') && text.includes('dedup_key') && text.includes("status IN ('open', 'acknowledged', 'in_progress')")) {
    return memAlerts.filter((a) => a.status === 'open' || a.status === 'acknowledged' || a.status === 'in_progress').slice(0, 1)
  }

  if (text.includes('FROM pilot_alerts') && text.includes('AND rule_id =')) {
    return []
  }

  if (text.includes('INSERT INTO pilot_alerts')) {
    const now = new Date().toISOString()
    const row: MemAlert = {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      orgId: '11111111-1111-1111-1111-111111111111',
      pilotId: '22222222-2222-2222-2222-222222222222',
      ruleId: '33333333-3333-3333-3333-333333333333',
      alertType: 'threshold',
      severity: 'critical',
      status: 'open',
      dedupKey: 'error_rate:1',
      correlationId: 'reliability:1',
      title: 'title',
      message: 'message',
      whatHappened: null,
      whyItMatters: null,
      whatToDoNext: null,
      playbookKey: 'integration_dlq',
      metricValue: 10,
      thresholdValue: 5,
      windowStart: now,
      windowEnd: now,
      occurrenceCount: 1,
      firstSeenAt: now,
      lastSeenAt: now,
      assigneeUserId: null,
      acknowledgedBy: null,
      acknowledgedAt: null,
      resolvedBy: null,
      resolutionNotes: null,
      escalatedAt: null,
      metricName: 'error_rate',
      detectedAt: now,
      resolvedAt: null,
      metadataJson: {},
    }
    memAlerts.push(row)
    return [row]
  }

  if (text.includes('UPDATE pilot_alerts') && text.includes('occurrence_count = occurrence_count + 1')) {
    const current = memAlerts[0]
    current.occurrenceCount += 1
    current.lastSeenAt = new Date().toISOString()
    return [current]
  }

  if (text.includes('INSERT INTO audit_log')) {
    return []
  }

  if (text.includes('FROM pilot_alert_escalations')) {
    return [escalationPolicy]
  }

  if (text.includes('FROM pilot_alerts') && text.includes('ORDER BY last_seen_at DESC')) {
    return memAlerts
  }

  if (text.includes('SET escalated_at = NOW()')) {
    const current = memAlerts[0]
    current.escalatedAt = new Date().toISOString()
    return [current]
  }

  return []
})

vi.mock('@nzila/db/platform', () => ({
  platformDb: {
    execute: executeMock,
  },
}))

import { __test__ } from './service'

describe('pilot alerting integration behavior', () => {
  beforeEach(() => {
    memAlerts = []
    executeMock.mockClear()
  })

  it('creates alert thread on first breach and updates occurrence on repeated breach', async () => {
    const rule = {
      id: '33333333-3333-3333-3333-333333333333',
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    await __test__.createOrUpdateAlertThread({
      orgId: rule.orgId,
      pilotId: rule.pilotId,
      rule,
      metricValue: 10,
      thresholdValue: 5,
      trend: 'up',
      dedupKey: 'error_rate:1',
      correlationId: 'reliability:1',
      windowStart: new Date().toISOString(),
      windowEnd: new Date().toISOString(),
      traceId: 'trace-1',
    })

    await __test__.createOrUpdateAlertThread({
      orgId: rule.orgId,
      pilotId: rule.pilotId,
      rule,
      metricValue: 11,
      thresholdValue: 5,
      trend: 'up',
      dedupKey: 'error_rate:1',
      correlationId: 'reliability:1',
      windowStart: new Date().toISOString(),
      windowEnd: new Date().toISOString(),
      traceId: 'trace-2',
    })

    expect(memAlerts.length).toBe(1)
    expect(memAlerts[0].occurrenceCount).toBe(2)
  })

  it('escalates open critical incidents when policy threshold is met', async () => {
    memAlerts = [
      {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        orgId: '11111111-1111-1111-1111-111111111111',
        pilotId: '22222222-2222-2222-2222-222222222222',
        ruleId: '33333333-3333-3333-3333-333333333333',
        alertType: 'threshold',
        severity: 'critical',
        status: 'open',
        dedupKey: 'error_rate:1',
        correlationId: 'reliability:1',
        title: 'title',
        message: 'message',
        whatHappened: null,
        whyItMatters: null,
        whatToDoNext: null,
        playbookKey: 'integration_dlq',
        metricValue: 12,
        thresholdValue: 5,
        windowStart: new Date().toISOString(),
        windowEnd: new Date().toISOString(),
        occurrenceCount: 1,
        firstSeenAt: new Date(Date.now() - 60_000).toISOString(),
        lastSeenAt: new Date().toISOString(),
        assigneeUserId: null,
        acknowledgedBy: null,
        acknowledgedAt: null,
        resolvedBy: null,
        resolutionNotes: null,
        escalatedAt: null,
        metricName: 'error_rate',
        detectedAt: new Date(Date.now() - 60_000).toISOString(),
        resolvedAt: null,
        metadataJson: {},
      },
    ]

    await __test__.runEscalationSweep(
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
      'trace-escalate',
    )

    expect(memAlerts[0].escalatedAt).not.toBeNull()
  })
})
