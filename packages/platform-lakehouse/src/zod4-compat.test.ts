import { describe, expect, it } from 'vitest'
import { warehouseProductMetricSchema } from './warehouse-schema'

const metric = { id: '11111111-1111-4111-8111-111111111111', domain: 'platform', orgId: 'tenant-a', metricName: 'requests', value: 5, periodStart: '2026-11-01T00:00:00.000Z', periodEnd: '2026-11-02T00:00:00.000Z', periodGranularity: 'daily', dimensions: { region: 'ca', count: 2 }, computedAt: '2026-11-02T10:00:00.000Z' }

describe('Zod 4 lakehouse metric boundary', () => {
  it('retains string-keyed dimensions and valid warehouse metrics', () => {
    expect(warehouseProductMetricSchema.parse(metric).dimensions).toEqual({ region: 'ca', count: 2 })
  })
  it('rejects invalid metrics and timestamps', () => {
    expect(warehouseProductMetricSchema.safeParse({ ...metric, value: '5' }).success).toBe(false)
    expect(warehouseProductMetricSchema.safeParse({ ...metric, computedAt: 'not-a-date' }).success).toBe(false)
  })
})
