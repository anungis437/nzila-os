import { describe, expect, it } from 'vitest'
import { ReasoningRequestSchema, ReasoningTypes } from './types'
const valid = { orgId: '550e8400-e29b-41d4-a716-446655440000', reasoningType: ReasoningTypes.CAUSAL, entityType: 'case', entityId: '550e8400-e29b-41d4-a716-446655440001', question: 'What caused this?', requestedBy: 'analyst-1' }
describe('Zod 4 reasoning request compatibility', () => {
  it('preserves valid requests', () => { expect(ReasoningRequestSchema.parse(valid)).toEqual(valid) })
  it('rejects unregistered modes and malformed tenant/entity IDs', () => {
    expect(ReasoningRequestSchema.safeParse({ ...valid, reasoningType: 'unregistered' }).success).toBe(false)
    expect(ReasoningRequestSchema.safeParse({ ...valid, orgId: 'another-tenant' }).success).toBe(false)
    expect(ReasoningRequestSchema.safeParse({ ...valid, entityId: 'not-a-uuid' }).success).toBe(false)
  })
  it('rejects missing actor and empty questions', () => {
    expect(ReasoningRequestSchema.safeParse({ ...valid, requestedBy: '' }).success).toBe(false)
    expect(ReasoningRequestSchema.safeParse({ ...valid, question: '' }).success).toBe(false)
  })
})
