import { describe, expect, it } from 'vitest'
import { AIOperationTypes, AIRunRequestSchema } from './types'
const valid = { tenantId: '550e8400-e29b-41d4-a716-446655440000', operationType: AIOperationTypes.RECOMMENDATION, modelId: 'model-v1', entityType: 'case', entityId: '550e8400-e29b-41d4-a716-446655440001', input: { question: 'summarize', context: { evidence: ['ref-1'] } }, requestedBy: 'reviewer-1' }
describe('Zod 4 governed AI request compatibility', () => {
  it('preserves nested input records', () => {
    expect(AIRunRequestSchema.parse(valid)).toEqual(valid)
    expect(AIRunRequestSchema.parse({ ...valid, input: {} }).input).toEqual({})
  })
  it('rejects non-record input and unknown operations', () => {
    expect(AIRunRequestSchema.safeParse({ ...valid, input: ['array'] }).success).toBe(false)
    expect(AIRunRequestSchema.safeParse({ ...valid, operationType: 'unapproved' }).success).toBe(false)
  })
  it('rejects malformed tenant/entity IDs and empty actor', () => {
    expect(AIRunRequestSchema.safeParse({ ...valid, tenantId: 'tenant-b' }).success).toBe(false)
    expect(AIRunRequestSchema.safeParse({ ...valid, entityId: 'not-a-uuid' }).success).toBe(false)
    expect(AIRunRequestSchema.safeParse({ ...valid, requestedBy: '' }).success).toBe(false)
  })
})
