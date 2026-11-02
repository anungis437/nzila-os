import { describe, expect, it } from 'vitest'
import { reviewDecisionSchema } from './index'

const valid = {id:'d1',workflow:'deployment-review',decision:'reject',decidedAt:'2026-11-02T10:00:00.000Z',reviewerRole:'independent-reviewer',citedDoctrine:['policy-1'],rationale:'Insufficient evidence'}

describe('Zod 4 governance-review schema compatibility', () => {
  it('accepts the canonical shape and rejects a malformed or unsafe input', () => {
    expect(reviewDecisionSchema.safeParse(valid).success).toBe(true)
    expect(reviewDecisionSchema.safeParse({...valid,decision:'approve_with_conditions'}).success).toBe(false)
  })
})
