import { describe, expect, it } from 'vitest'
import { continuityReviewCardSchema } from './index'

const valid = {dimension:'governance-friction',banding:'warming',trajectory:'holding',scope:{kind:'system',systemId:'sys-a'},interpretation:'Review pending',stabilizationGuidance:'Maintain cadence',observedAt:'2026-11-02T10:00:00.000Z',windowMinutes:30}

describe('Zod 4 continuity-review schema compatibility', () => {
  it('accepts the canonical shape and rejects a malformed or unsafe input', () => {
    expect(continuityReviewCardSchema.safeParse(valid).success).toBe(true)
    expect(continuityReviewCardSchema.safeParse({...valid,interpretation:'userId=123'}).success).toBe(false)
  })
})
