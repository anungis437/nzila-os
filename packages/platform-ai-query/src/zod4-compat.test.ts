import { describe, expect, it } from 'vitest'
import { naturalLanguageQuerySchema, queryResultSchema } from './types'

const query = { id: '11111111-1111-4111-8111-111111111111', query: 'Show evidence', orgId: 'tenant-1', actor: 'user-1', timestamp: '2026-11-02T10:00:00.000Z', context: { filters: { type: 'audit' } } }

describe('Zod 4 AI query boundary', () => {
  it('retains structured query context', () => {
    expect(naturalLanguageQuerySchema.parse(query).context).toEqual(query.context)
  })
  it('rejects malformed query identity and confidence', () => {
    expect(naturalLanguageQuerySchema.safeParse({ ...query, id: 'wrong' }).success).toBe(false)
    const result = { id: '11111111-1111-4111-8111-111111111111', queryId: '22222222-2222-4222-8222-222222222222', answer: 'yes', confidence: 1.5, evidenceRefs: [], timestamp: '2026-11-02T10:00:00.000Z' }
    expect(queryResultSchema.safeParse(result).success).toBe(false)
  })
})
