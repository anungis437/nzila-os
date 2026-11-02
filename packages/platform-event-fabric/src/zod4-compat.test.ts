import { describe, expect, it } from 'vitest'
import { PlatformEventSchema } from './types'

const event = { id: '11111111-1111-4111-8111-111111111111', type: 'case.created', payload: { caseId: 'case-1', nested: { source: 'test' } }, metadata: { tenantId: '11111111-1111-4111-8111-111111111111', actorId: 'actor-1', correlationId: '22222222-2222-4222-8222-222222222222', source: 'test', version: 1 }, createdAt: '2026-11-02T10:00:00.000Z' }

describe('Zod 4 event fabric boundary', () => {
  it('preserves arbitrary payload dictionaries and trusted metadata shape', () => {
    expect(PlatformEventSchema.parse(event).payload).toEqual(event.payload)
  })
  it('rejects malformed tenant and correlation identities', () => {
    expect(PlatformEventSchema.safeParse({ ...event, metadata: { ...event.metadata, tenantId: 'wrong' } }).success).toBe(false)
    expect(PlatformEventSchema.safeParse({ ...event, metadata: { ...event.metadata, correlationId: 'wrong' } }).success).toBe(false)
  })
})
