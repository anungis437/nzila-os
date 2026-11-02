import { describe, expect, it } from 'vitest'
import { RecordSignalSchema, RequestRecommendationsSchema, RequestFraudCheckSchema } from './types'
describe('Zod 4 intelligence ingress compatibility', () => {
  it('preserves optional nested signal context and default weight', () => {
    const signal = { userId: 'user-1', signalType: 'play', targetId: 'track-1', targetType: 'track' }
    expect(RecordSignalSchema.parse(signal).weight).toBe(1)
    expect(RecordSignalSchema.parse({ ...signal, context: { nested: { source: 'feed' } } }).context).toEqual({ nested: { source: 'feed' } })
    expect(RecordSignalSchema.safeParse({ ...signal, context: ['invalid'] }).success).toBe(false)
    expect(RecordSignalSchema.safeParse({ ...signal, signalType: 'forged' }).success).toBe(false)
  })
  it('enforces recommendation budgets and fraud entity boundaries', () => {
    expect(RequestRecommendationsSchema.parse({ userId: 'user-1' }).limit).toBe(20)
    expect(RequestRecommendationsSchema.safeParse({ userId: 'user-1', limit: 101 }).success).toBe(false)
    expect(RequestFraudCheckSchema.safeParse({ targetEntityId: 'entity-1', entityType: 'forged' }).success).toBe(false)
  })
})
