import { describe, expect, it } from 'vitest'
import { MatchResult } from './types'

const valid = {patientId:'p1',score:0.9,confidence:'high',matchedFields:['mrn']}

describe('Zod 4 patient-identity schema compatibility', () => {
  it('accepts the canonical shape and rejects a malformed or unsafe input', () => {
    expect(MatchResult.safeParse(valid).success).toBe(true)
    expect(MatchResult.safeParse({...valid,score:-0.1}).success).toBe(false)
  })
})
