import { describe, expect, it } from 'vitest'
import { SourceRecordSchema, CanonicalRecordSchema } from './types'

const source = { id: '11111111-1111-4111-8111-111111111111', sourceSystem: 'crm', sourceCategory: 'crm', sourceRecordId: 'external-1', tenantId: '22222222-2222-4222-8222-222222222222', rawPayload: { field: 1, nested: { ok: true } }, ingestedAt: '2026-11-02T10:00:00.000Z' }

describe('Zod 4 data fabric boundary', () => {
  it('preserves tenant-scoped source and canonical payload dictionaries', () => {
    expect(SourceRecordSchema.parse(source).rawPayload).toEqual(source.rawPayload)
    const canonical = { id: '11111111-1111-4111-8111-111111111111', tenantId: '22222222-2222-4222-8222-222222222222', entityType: 'Person', entityId: '11111111-1111-4111-8111-111111111111', sourceSystem: 'crm', sourceRecordId: 'external-1', mappingVersion: 1, transformationLog: [], payload: { field: 'mapped' }, ingestedAt: '2026-11-02T10:00:00.000Z', mappedAt: '2026-11-02T10:00:00.000Z' }
    expect(CanonicalRecordSchema.parse(canonical).payload).toEqual(canonical.payload)
  })
  it('rejects invalid tenants and unsupported source categories', () => {
    expect(SourceRecordSchema.safeParse({ ...source, tenantId: 'wrong' }).success).toBe(false)
    expect(SourceRecordSchema.safeParse({ ...source, sourceCategory: 'unknown' }).success).toBe(false)
  })
})
