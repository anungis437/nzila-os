import { beforeEach, describe, expect, it, vi } from 'vitest'

function queryText(query: unknown): string {
  const chunks = (query as { queryChunks?: unknown[] }).queryChunks ?? []
  return chunks
    .map((c: unknown) => {
      if (typeof c === 'string') return c
      if (typeof c === 'number') return String(c)
      if (c !== null && typeof c === 'object' && Array.isArray((c as { value?: unknown }).value)) {
        return ((c as { value: string[] }).value).join('')
      }
      return ''
    })
    .join('')
}

const { executeMock } = vi.hoisted(() => ({ executeMock: vi.fn() }))

vi.mock('@nzila/db/platform', () => ({
  platformDb: {
    execute: executeMock,
  },
}))

import { acknowledgeAlert, escalateAlert, recordPilotMetricEvent, resolveAlert } from './service'

let pilotOrgId = '11111111-1111-1111-1111-111111111111'

executeMock.mockImplementation(async (query: unknown) => {
  const text = queryText(query)

  if (text.includes('FROM pilot_definitions') && text.includes('LIMIT 1')) {
    return [{ orgId: pilotOrgId, appScope: 'union-eyes' }]
  }

  if (text.includes('INSERT INTO pilot_metric_events')) {
    return [{ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }]
  }

  if (text.includes('INSERT INTO audit_log')) {
    return []
  }

  return []
})

describe('recordPilotMetricEvent audit enforcement', () => {
  beforeEach(() => {
    pilotOrgId = '11111111-1111-1111-1111-111111111111'
    executeMock.mockClear()
  })

  it('rejects writes without traceId', async () => {
    await expect(recordPilotMetricEvent({
      orgId: '11111111-1111-1111-1111-111111111111',
      pilotId: '22222222-2222-2222-2222-222222222222',
      appScope: 'union-eyes',
      metricType: 'operations',
      metricName: 'cases_created',
      valueNumeric: 1,
      occurredAt: new Date().toISOString(),
    }, {
      actorId: 'user-123',
      traceId: '',
    })).rejects.toThrow('traceId')
  })

  it('rejects writes without orgId', async () => {
    await expect(recordPilotMetricEvent({
      orgId: '' as unknown as string,
      pilotId: '22222222-2222-2222-2222-222222222222',
      appScope: 'union-eyes',
      metricType: 'operations',
      metricName: 'cases_created',
      valueNumeric: 1,
      occurredAt: new Date().toISOString(),
    }, {
      actorId: 'user-123',
      traceId: 'trace-org-missing',
    })).rejects.toThrow('requires orgId')
  })

  it('rejects writes without pilotId', async () => {
    await expect(recordPilotMetricEvent({
      orgId: '11111111-1111-1111-1111-111111111111',
      pilotId: '' as unknown as string,
      appScope: 'union-eyes',
      metricType: 'operations',
      metricName: 'cases_created',
      valueNumeric: 1,
      occurredAt: new Date().toISOString(),
    }, {
      actorId: 'user-123',
      traceId: 'trace-pilot-missing',
    })).rejects.toThrow('requires pilotId')
  })

  it('rejects writes without appScope', async () => {
    await expect(recordPilotMetricEvent({
      orgId: '11111111-1111-1111-1111-111111111111',
      pilotId: '22222222-2222-2222-2222-222222222222',
      appScope: '' as unknown as 'union-eyes',
      metricType: 'operations',
      metricName: 'cases_created',
      valueNumeric: 1,
      occurredAt: new Date().toISOString(),
    }, {
      actorId: 'user-123',
      traceId: 'trace-scope-missing',
    })).rejects.toThrow('requires appScope')
  })

  it('rejects writes without actor or system actor', async () => {
    await expect(recordPilotMetricEvent({
      orgId: '11111111-1111-1111-1111-111111111111',
      pilotId: '22222222-2222-2222-2222-222222222222',
      appScope: 'union-eyes',
      metricType: 'operations',
      metricName: 'cases_created',
      valueNumeric: 1,
      occurredAt: new Date().toISOString(),
    }, {
      traceId: 'trace-1',
    })).rejects.toThrow('actorId or systemActorId')
  })

  it('rejects org and pilot mismatches', async () => {
    pilotOrgId = '99999999-9999-9999-9999-999999999999'

    await expect(recordPilotMetricEvent({
      orgId: '11111111-1111-1111-1111-111111111111',
      pilotId: '22222222-2222-2222-2222-222222222222',
      appScope: 'union-eyes',
      metricType: 'operations',
      metricName: 'cases_created',
      valueNumeric: 1,
      occurredAt: new Date().toISOString(),
    }, {
      actorId: 'user-123',
      traceId: 'trace-2',
    })).rejects.toThrow('orgId and pilotId mismatch')
  })

  it('always writes an audit linkage record on success', async () => {
    await recordPilotMetricEvent({
      orgId: '11111111-1111-1111-1111-111111111111',
      pilotId: '22222222-2222-2222-2222-222222222222',
      appScope: 'union-eyes',
      metricType: 'operations',
      metricName: 'cases_created',
      valueNumeric: 1,
      occurredAt: new Date().toISOString(),
    }, {
      systemActorId: 'system:ue-sla-watchdog',
      traceId: 'trace-3',
    })

    const sqlTexts = executeMock.mock.calls.map((call) => queryText(call[0]))
    expect(sqlTexts.some((text) => text.includes('INSERT INTO pilot_metric_events'))).toBe(true)
    expect(sqlTexts.some((text) => text.includes('INSERT INTO audit_log'))).toBe(true)
  })

  it('audits alert lifecycle actions', async () => {
    executeMock.mockImplementation(async (query: unknown) => {
      const text = queryText(query)
      if (text.includes('FROM pilot_alerts') && text.includes('ORDER BY last_seen_at DESC')) {
        return [{
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
          windowStart: new Date().toISOString(),
          windowEnd: new Date().toISOString(),
          occurrenceCount: 1,
          firstSeenAt: new Date().toISOString(),
          lastSeenAt: new Date().toISOString(),
          assigneeUserId: null,
          acknowledgedBy: null,
          acknowledgedAt: null,
          resolvedBy: null,
          resolutionNotes: null,
          escalatedAt: null,
          metricName: 'error_rate',
          detectedAt: new Date().toISOString(),
          resolvedAt: null,
          metadataJson: {},
        }]
      }
      if (text.includes('FROM pilot_alert_escalations')) {
        return [{
          id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
          orgId: '11111111-1111-1111-1111-111111111111',
          pilotId: '22222222-2222-2222-2222-222222222222',
          severity: 'critical',
          notifyAfterMinutes: 0,
          escalationChannel: 'webhook',
          escalationTarget: 'webhook://test',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }]
      }
      if (text.includes('UPDATE pilot_alerts')) {
        return [{
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          orgId: '11111111-1111-1111-1111-111111111111',
          pilotId: '22222222-2222-2222-2222-222222222222',
          ruleId: '33333333-3333-3333-3333-333333333333',
          alertType: 'threshold',
          severity: 'critical',
          status: 'resolved',
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
          windowStart: new Date().toISOString(),
          windowEnd: new Date().toISOString(),
          occurrenceCount: 1,
          firstSeenAt: new Date().toISOString(),
          lastSeenAt: new Date().toISOString(),
          assigneeUserId: null,
          acknowledgedBy: null,
          acknowledgedAt: null,
          resolvedBy: null,
          resolutionNotes: null,
          escalatedAt: null,
          metricName: 'error_rate',
          detectedAt: new Date().toISOString(),
          resolvedAt: null,
          metadataJson: {},
        }]
      }
      if (text.includes('INSERT INTO audit_log')) {
        return []
      }
      return []
    })

    await acknowledgeAlert('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', {
      actorId: 'user-1',
      traceId: 'trace-ack',
    })

    await resolveAlert('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', {
      actorId: 'user-1',
      traceId: 'trace-resolve',
    })

    await escalateAlert('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', {
      actorId: 'user-1',
      traceId: 'trace-escalate',
    }, true)

    const sqlTexts = executeMock.mock.calls.map((call) => queryText(call[0]))
    expect(sqlTexts.some((text) => text.includes('pilot.alert.acknowledged'))).toBe(true)
    expect(sqlTexts.some((text) => text.includes('pilot.alert.resolved'))).toBe(true)
    expect(sqlTexts.some((text) => text.includes('pilot.alert.escalated'))).toBe(true)
  })
})
