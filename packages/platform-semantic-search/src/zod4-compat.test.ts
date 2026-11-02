import { describe, expect, it } from 'vitest'
import { IndexDocumentSchema, SearchModes, SearchQuerySchema } from './types'
const tenantId = '550e8400-e29b-41d4-a716-446655440000'
const doc = { tenantId, entityType: 'case', entityId: '550e8400-e29b-41d4-a716-446655440001', title: 'Evidence', content: 'Source material', metadata: { origin: 'case-file', nested: { score: 0.8 } } }
describe('Zod 4 semantic search compatibility', () => {
  it('preserves bounded query defaults', () => {
    expect(SearchQuerySchema.parse({ tenantId, query: 'evidence', mode: SearchModes.LEXICAL })).toMatchObject({ limit: 20, offset: 0, graphExpansion: false, graphDepth: 1 })
    expect(SearchQuerySchema.safeParse({ tenantId, query: 'x', mode: SearchModes.LEXICAL, limit: 101 }).success).toBe(false)
    expect(SearchQuerySchema.safeParse({ tenantId, query: 'x', mode: SearchModes.LEXICAL, graphDepth: 4 }).success).toBe(false)
  })
  it('preserves string-keyed metadata and default records', () => {
    expect(IndexDocumentSchema.parse(doc)).toMatchObject(doc)
    expect(IndexDocumentSchema.parse({ ...doc, metadata: undefined }).metadata).toEqual({})
  })
  it('rejects array metadata, malformed tenants and invalid modes', () => {
    expect(IndexDocumentSchema.safeParse({ ...doc, metadata: ['array'] }).success).toBe(false)
    expect(IndexDocumentSchema.safeParse({ ...doc, tenantId: 'other-tenant' }).success).toBe(false)
    expect(SearchQuerySchema.safeParse({ tenantId, query: 'x', mode: 'unregistered' }).success).toBe(false)
    expect(SearchQuerySchema.safeParse({ tenantId, query: '', mode: SearchModes.HYBRID }).success).toBe(false)
  })
})
