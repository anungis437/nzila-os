import { describe, expect, it } from 'vitest'
import { ContextRequestSchema } from './types'

const request = { tenantId: '11111111-1111-4111-8111-111111111111', purpose: 'workflow', entityType: 'Case', entityId: '22222222-2222-4222-8222-222222222222', caller: {}, graphDepth: 5, eventLimit: 100 }

describe('Zod 4 context request boundary', () => {
  it('accepts bounded tenant-scoped requests', () => {
    expect(ContextRequestSchema.safeParse(request).success).toBe(true)
  })
  it('rejects invalid tenant, graph depth and event limits', () => {
    expect(ContextRequestSchema.safeParse({ ...request, tenantId: 'not-a-uuid' }).success).toBe(false)
    expect(ContextRequestSchema.safeParse({ ...request, graphDepth: 6 }).success).toBe(false)
    expect(ContextRequestSchema.safeParse({ ...request, eventLimit: 101 }).success).toBe(false)
  })
})
