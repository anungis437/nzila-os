import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { transitionSchema, transitionTargetStatuses } from '../../app/api/workflow/transition/schemas'

const validStatusArb = fc.constantFrom(...transitionTargetStatuses)

describe('workflow transition schema fuzzing', () => {
  it('accepts valid transition payloads', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        validStatusArb,
        fc.option(fc.string({ minLength: 0, maxLength: 5000 }), { nil: undefined }),
        (claimNumber, targetStatus, notes) => {
          const payload = notes === undefined ? { claimNumber, targetStatus } : { claimNumber, targetStatus, notes }
          const parsed = transitionSchema.safeParse(payload)

          expect(parsed.success).toBe(true)
        },
      ),
      { numRuns: 150 },
    )
  })

  it('rejects out-of-range claim numbers', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(''), fc.string({ minLength: 101, maxLength: 240 })),
        validStatusArb,
        (claimNumber, targetStatus) => {
          const parsed = transitionSchema.safeParse({ claimNumber, targetStatus })
          expect(parsed.success).toBe(false)
        },
      ),
      { numRuns: 120 },
    )
  })

  it('rejects unsupported target statuses and oversized notes', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string().filter((status) => !transitionTargetStatuses.includes(status as (typeof transitionTargetStatuses)[number])),
        fc.string({ minLength: 5001, maxLength: 5200 }),
        (claimNumber, targetStatus, notes) => {
          const parsed = transitionSchema.safeParse({ claimNumber, targetStatus, notes })
          expect(parsed.success).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })
})