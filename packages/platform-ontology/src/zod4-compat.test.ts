import { describe, expect, it } from 'vitest'
import { CreateOntologyEntitySchema, OntologyEntitySchema } from './validators'

const tenantId = '11111111-1111-4111-8111-111111111111'

describe('Zod 4 ontology boundary', () => {
  it('preserves metadata dictionaries and defaulted entity fields', () => {
    const input = { tenantId, entityType: 'Person', canonicalName: 'Member', metadata: { source: 'test', flags: { active: true } } }
    expect(CreateOntologyEntitySchema.parse(input).metadata).toEqual(input.metadata)
    const entity = OntologyEntitySchema.parse({ ...input, id: '22222222-2222-4222-8222-222222222222', createdAt: '2026-11-02T10:00:00.000Z', updatedAt: '2026-11-02T10:00:00.000Z' })
    expect(entity.tags).toEqual([])
    expect(entity.status).toBe('active')
  })
  it('rejects invalid tenant identifiers and empty canonical names', () => {
    expect(CreateOntologyEntitySchema.safeParse({ tenantId: 'wrong', entityType: 'Person', canonicalName: 'Member' }).success).toBe(false)
    expect(CreateOntologyEntitySchema.safeParse({ tenantId, entityType: 'Person', canonicalName: '' }).success).toBe(false)
  })
})
