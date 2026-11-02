import { describe, expect, it } from 'vitest'
import { assuranceDimensionInputSchema } from './bands'

const validInput = {
  dimension: 'governance-legitimacy',
  scope: { kind: 'platform' },
  observed: 10,
  compliant: 9,
  signalCompleteness: 0.8,
  evidence: [{ id: 'evidence-1', contentHash: '0123456789abcdef', description: 'Source proof' }],
  windowStart: '2026-11-01T00:00:00Z',
  windowEnd: '2026-11-02T00:00:00Z',
}

describe('Zod 4 assurance boundary regression', () => {
  it('preserves a valid strict dimension input and evidence', () => {
    const parsed = assuranceDimensionInputSchema.parse(validInput)
    expect(parsed.scope).toEqual({ kind: 'platform' })
    expect(parsed.evidence).toHaveLength(1)
  })
  it('rejects compliant observations greater than observed', () => {
    expect(assuranceDimensionInputSchema.safeParse({ ...validInput, compliant: 11 }).success).toBe(false)
  })
  it('rejects malformed scope and unexpected fields', () => {
    expect(assuranceDimensionInputSchema.safeParse({ ...validInput, scope: { kind: 'product' } }).success).toBe(false)
    expect(assuranceDimensionInputSchema.safeParse({ ...validInput, unauthorized: true }).success).toBe(false)
  })
  it('rejects invalid numeric bounds and malformed evidence', () => {
    expect(assuranceDimensionInputSchema.safeParse({ ...validInput, signalCompleteness: 1.1 }).success).toBe(false)
    expect(assuranceDimensionInputSchema.safeParse({ ...validInput, evidence: [{ id: 'x', contentHash: 'short', description: 'x' }] }).success).toBe(false)
  })
})
