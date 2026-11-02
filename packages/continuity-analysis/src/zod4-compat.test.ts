import { describe, expect, it } from 'vitest'
import { continuityRiskSignalSchema } from './schema'

const valid = {id:'123e4567-e89b-42d3-a456-426614174000',orgId:'org-a',category:'governance-drift',description:'risk',severity:2,exposure:3,detectability:4,riskIndex:24,evidenceRefs:[],affectedSystems:[],affectedRoles:[],mitigationState:'partial',mitigationNotes:'planned',detectedAt:'2026-11-02T10:00:00.000Z',updatedAt:'2026-11-02T10:00:00.000Z'}

describe('Zod 4 continuity-analysis schema compatibility', () => {
  it('accepts the canonical shape and rejects a malformed or unsafe input', () => {
    expect(continuityRiskSignalSchema.safeParse(valid).success).toBe(true)
    expect(continuityRiskSignalSchema.safeParse({...valid,riskIndex:126}).success).toBe(false)
  })
})
