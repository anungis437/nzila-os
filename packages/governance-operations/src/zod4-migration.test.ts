import { describe, expect, it } from 'vitest'
import { postureCardSchema } from './posture'

const card = { id: 'card-1', surface: 'operations', product: 'union-eyes', banding: 'stable', interpretation: 'Maintaining posture', doctrineCitations: [{ document: 'doctrine.md' }], observedAt: '2026-11-02T12:00:00.000Z' } as const

describe('Zod 4 governance posture inputs', () => {
  it('preserves cited banded readings', () => {
    expect(postureCardSchema.parse(card).banding).toBe('stable')
  })
  it('rejects absent citations, invalid bands and malformed timestamps', () => {
    expect(postureCardSchema.safeParse({ ...card, doctrineCitations: [] }).success).toBe(false)
    expect(postureCardSchema.safeParse({ ...card, banding: 'approved' }).success).toBe(false)
    expect(postureCardSchema.safeParse({ ...card, observedAt: 'tomorrow' }).success).toBe(false)
  })
})
