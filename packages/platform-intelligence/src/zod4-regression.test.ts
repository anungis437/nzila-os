import { describe, expect, it } from 'vitest'
import { aggregatedEventSchema, crossAppInsightSchema, operationalSignalSchema } from './types'
const id = '00000000-0000-0000-0000-000000000001'
const timestamp = '2026-11-02T12:00:00Z'
describe('Zod 4 intelligence event boundaries', () => {
  it('retains legacy GUID shape and rejects malformed event payloads', () => {
    const event = { id, source: 'app', eventType: 'event', timestamp, app: 'cfo', orgId: 'org-1', payload: { count: 2 } }
    expect(aggregatedEventSchema.parse(event).payload).toEqual({ count: 2 })
    expect(aggregatedEventSchema.safeParse({ ...event, payload: ['bad'] }).success).toBe(false)
    expect(aggregatedEventSchema.safeParse({ ...event, id: 'invalid' }).success).toBe(false)
  })
  it('retains insight record validation and rejects invalid severity', () => {
    const insight = { id, timestamp, category: 'usage', severity: 'info', apps: ['cfo'], title: 'Title', description: 'Description', dataPoints: { count: 2 }, recommendations: [] }
    expect(crossAppInsightSchema.safeParse(insight).success).toBe(true)
    expect(crossAppInsightSchema.safeParse({ ...insight, dataPoints: ['bad'] }).success).toBe(false)
    expect(crossAppInsightSchema.safeParse({ ...insight, severity: 'approved' }).success).toBe(false)
  })
  it('retains signal confidence bounds', () => {
    const signal = { id, timestamp, signalType: 'spike', app: 'cfo', metric: 'usage', currentValue: 2, baselineValue: 1, deviationPercent: 100, confidence: 0.8 }
    expect(operationalSignalSchema.safeParse(signal).success).toBe(true)
    expect(operationalSignalSchema.safeParse({ ...signal, confidence: 1.5 }).success).toBe(false)
  })
})
