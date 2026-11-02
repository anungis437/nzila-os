import { describe, expect, it } from 'vitest'
import { RUMEventSchema } from './types'
import { processRUMBatch } from './reporter'

const metric = { name: 'LCP', value: 1500, rating: 'good', delta: 100, id: 'metric-1' }
const event = { metric, pathname: '/home', appName: 'console', environment: 'test', timestamp: new Date('2026-11-02T10:00:00.000Z') }

describe('Zod 4 RUM boundary', () => {
  it('accepts valid event metrics and rejects unsupported metrics', () => {
    expect(RUMEventSchema.safeParse(event).success).toBe(true)
    expect(RUMEventSchema.safeParse({ ...event, metric: { ...metric, name: 'BAD' } }).success).toBe(false)
  })
  it('retains beacon timestamp coercion and rejects invalid batches', async () => {
    expect((await processRUMBatch([{ ...event, timestamp: '2026-11-02T10:00:00.000Z' }])).valid).toBe(1)
    expect((await processRUMBatch([{ ...event, metric: { ...metric, rating: 'invalid' } }])).invalid).toBe(1)
  })
})
