import { describe, expect, it } from 'vitest'
import { CreateKnowledgeAssetSchema, KnowledgeAssetSchema, KnowledgeStatuses, KnowledgeTypes } from './types'

const date = '2026-11-02T12:00:00.000Z'
const valid = { tenantScope: 'tenant-a', domainScope: 'compliance', title: 'Compliance rule', knowledgeType: KnowledgeTypes.RULE, source: 'compliance-team', effectiveDate: date, structuredPayload: { nested: { active: true }, threshold: 3 } }

describe('Zod 4 knowledge registry schemas', () => {
  it('accepts nested string-keyed records and preserves defaults', () => {
    const created = CreateKnowledgeAssetSchema.parse(valid)
    expect(created.structuredPayload).toEqual(valid.structuredPayload)
    const asset = KnowledgeAssetSchema.parse({ ...valid, id: '00000000-0000-4000-8000-000000000001', version: 1, status: KnowledgeStatuses.ACTIVE, createdAt: date, updatedAt: date })
    expect(asset.structuredPayload).toEqual(valid.structuredPayload)
    expect(asset.tags).toEqual([])
    expect(asset.textPayload).toBe('')
  })
  it('rejects non-record payloads, invalid tenants, and unknown knowledge types', () => {
    expect(CreateKnowledgeAssetSchema.safeParse({ ...valid, structuredPayload: [] }).success).toBe(false)
    expect(CreateKnowledgeAssetSchema.safeParse({ ...valid, tenantScope: '' }).success).toBe(false)
    expect(CreateKnowledgeAssetSchema.safeParse({ ...valid, knowledgeType: 'invalid' }).success).toBe(false)
    expect(CreateKnowledgeAssetSchema.safeParse({ ...valid, effectiveDate: 'not-a-date' }).success).toBe(false)
  })
})
