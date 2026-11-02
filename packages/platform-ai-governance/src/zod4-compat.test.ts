import { describe, expect, it } from 'vitest'
import { modelRegistryEntrySchema, promptVersionSchema } from './types'

const model = { id: '11111111-1111-4111-8111-111111111111', name: 'sample', version: '1', provider: 'test', capabilities: ['classify'], riskLevel: 'low', approvedForProduction: false, registeredAt: '2026-11-02T10:00:00.000Z' }

describe('Zod 4 AI governance boundary', () => {
  it('accepts valid model entries without granting production approval', () => {
    expect(modelRegistryEntrySchema.parse(model).approvedForProduction).toBe(false)
  })
  it('rejects unsupported risk levels and invalid prompt versions', () => {
    expect(modelRegistryEntrySchema.safeParse({ ...model, riskLevel: 'unknown' }).success).toBe(false)
    const prompt = { id: '22222222-2222-4222-8222-222222222222', promptName: 'sample', version: 0, template: 'test', author: 'user', createdAt: '2026-11-02T10:00:00.000Z', active: false, changeReason: 'test' }
    expect(promptVersionSchema.safeParse(prompt).success).toBe(false)
  })
})
