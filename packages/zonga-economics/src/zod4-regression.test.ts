import { describe, expect, it } from 'vitest'
import { RecordRevenueEventSchema, GeneratePayoutsSchema } from './types'
const event = { orgId: 'org-1', source: 'stream', grossAmount: 10, currency: 'USD' }
describe('Zod 4 economics ingress', () => {
  it('preserves record defaults and nested metadata', () => {
    expect(RecordRevenueEventSchema.parse(event).metadata).toEqual({})
    expect(RecordRevenueEventSchema.parse({ ...event, metadata: { nested: { count: 2 } } }).metadata).toEqual({ nested: { count: 2 } })
  })
  it('rejects malformed sources, amounts, metadata, and dates', () => {
    expect(RecordRevenueEventSchema.safeParse({ ...event, source: 'forged' }).success).toBe(false)
    expect(RecordRevenueEventSchema.safeParse({ ...event, grossAmount: -1 }).success).toBe(false)
    expect(RecordRevenueEventSchema.safeParse({ ...event, metadata: ['invalid'] }).success).toBe(false)
    expect(GeneratePayoutsSchema.safeParse({ orgId: 'org-1', periodStart: 'invalid', periodEnd: '2026-01-31', currency: 'USD' }).success).toBe(false)
  })
})
