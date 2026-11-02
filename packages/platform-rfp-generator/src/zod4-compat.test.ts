import { describe, expect, it } from 'vitest'
import { rfpAnswerSchema } from './types'

const answer = { section: 'security', question: 'Encryption?', answer: 'Yes', evidenceRefs: ['artifact-1'], confidenceLevel: 'high' }

describe('Zod 4 RFP answer boundary', () => {
  it('accepts supported evidence-backed sections', () => {
    expect(rfpAnswerSchema.safeParse(answer).success).toBe(true)
  })
  it('rejects unsupported sections and malformed evidence references', () => {
    expect(rfpAnswerSchema.safeParse({ ...answer, section: 'unknown' }).success).toBe(false)
    expect(rfpAnswerSchema.safeParse({ ...answer, evidenceRefs: [123] }).success).toBe(false)
  })
})
