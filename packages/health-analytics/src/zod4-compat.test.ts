import { describe, expect, it } from 'vitest'
import { DuplicateTestRisk } from './types'

const valid = {score:0.5,affectedPatientCount:2,estimatedWastePercent:12}

describe('Zod 4 health-analytics schema compatibility', () => {
  it('accepts the canonical shape and rejects a malformed or unsafe input', () => {
    expect(DuplicateTestRisk.safeParse(valid).success).toBe(true)
    expect(DuplicateTestRisk.safeParse({...valid,score:1.1}).success).toBe(false)
  })
})
