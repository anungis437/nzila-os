import { describe, expect, it } from 'vitest'
import {
  PilotMetricEventSchema,
  PilotDefinitionSchema,
  PilotMetricNameSchema,
  PILOT_METRIC_TAXONOMY,
} from './index'

describe('platform-pilot-metrics-types', () => {
  it('validates canonical metric event payload', () => {
    const parsed = PilotMetricEventSchema.parse({
      orgId: '11111111-1111-4111-8111-111111111111',
      pilotId: '22222222-2222-4222-8222-222222222222',
      appScope: 'union-eyes',
      metricType: 'operations',
      metricName: 'cases_created',
      valueNumeric: 1,
      occurredAt: new Date().toISOString(),
    })

    expect(parsed.metricName).toBe('cases_created')
  })

  it('validates arbitrary metadata keys with the Zod 4 two-argument record API', () => {
    const result = PilotMetricEventSchema.safeParse({
      orgId: '11111111-1111-4111-8111-111111111111',
      pilotId: '22222222-2222-4222-8222-222222222222',
      appScope: 'union-eyes',
      metricType: 'operations',
      metricName: 'cases_created',
      occurredAt: new Date().toISOString(),
      valueJson: { source: 'intake', count: 2 },
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.valueJson).toEqual({ source: 'intake', count: 2 })
  })

  it('rejects malformed UUID variants independently of metadata', () => {
    const payload = {
      id: '11111111-1111-4111-8111-111111111111',
      orgId: '22222222-2222-4222-8222-222222222222',
      appScope: 'zonga',
      pilotName: 'test',
      pilotType: 'event-creator',
      status: 'active',
      startedAt: new Date().toISOString(),
      targetEndAt: null,
      ownerUserId: null,
      metadataJson: {},
    }
    expect(PilotDefinitionSchema.safeParse(payload).success).toBe(true)
    expect(PilotDefinitionSchema.safeParse({
      ...payload,
      id: '11111111-1111-1111-1111-111111111111',
    }).success).toBe(false)
  })

  it('rejects non-record metadata independently of UUID validity', () => {
    const result = PilotDefinitionSchema.safeParse({
      id: '11111111-1111-4111-8111-111111111111',
      orgId: '22222222-2222-4222-8222-222222222222',
      appScope: 'zonga',
      pilotName: 'test',
      pilotType: 'event-creator',
      status: 'active',
      startedAt: new Date().toISOString(),
      targetEndAt: null,
      ownerUserId: null,
      metadataJson: [],
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.some((issue) => issue.path.join('.') === 'metadataJson')).toBe(true)
  })

  it('contains required taxonomy metrics', () => {
    expect(PILOT_METRIC_TAXONOMY.some((m) => m.metricName === 'cases_created')).toBe(true)
    expect(PILOT_METRIC_TAXONOMY.some((m) => m.metricName === 'tickets_sold')).toBe(true)
    expect(PILOT_METRIC_TAXONOMY.some((m) => m.metricName === 'gross_revenue')).toBe(true)
    expect(PILOT_METRIC_TAXONOMY.some((m) => m.metricName === 'dead_letter_count')).toBe(true)
  })

  it('rejects unknown metric name', () => {
    expect(() => PilotMetricNameSchema.parse('vanity_likes')).toThrow()
  })

  it('validates pilot definition shape', () => {
    const parsed = PilotDefinitionSchema.parse({
      id: '11111111-1111-4111-8111-111111111111',
      orgId: '22222222-2222-4222-8222-222222222222',
      appScope: 'zonga',
      pilotName: 'MS Celebrations pilot',
      pilotType: 'event-creator',
      status: 'active',
      startedAt: new Date().toISOString(),
      targetEndAt: null,
      ownerUserId: 'owner-1',
      metadataJson: {},
    })

    expect(parsed.status).toBe('active')
  })
})
