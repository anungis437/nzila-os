import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { assignSchema } from '../../app/api/workbench/assign/schemas'

describe('workbench assign schema fuzzing', () => {
  it('accepts valid assignment payloads', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.option(fc.string({ minLength: 1, maxLength: 64 }), { nil: undefined }),
        (claimId, assignTo) => {
          const payload = assignTo === undefined ? { claimId } : { claimId, assignTo }
          const parsed = assignSchema.safeParse(payload)

          expect(parsed.success).toBe(true)
          if (parsed.success) {
            expect(parsed.data.claimId).toBe(claimId)
            expect(parsed.data.assignTo).toBe(assignTo)
          }
        },
      ),
      { numRuns: 150 },
    )
  })

  it('rejects malformed claim ids', () => {
    fc.assert(
      fc.property(
        fc.string().filter((value) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)),
        fc.option(fc.string({ minLength: 1, maxLength: 64 }), { nil: undefined }),
        (claimId, assignTo) => {
          const payload = assignTo === undefined ? { claimId } : { claimId, assignTo }
          const parsed = assignSchema.safeParse(payload)

          expect(parsed.success).toBe(false)
        },
      ),
      { numRuns: 150 },
    )
  })

  it('rejects non-string assignee values', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.oneof(fc.integer(), fc.boolean(), fc.array(fc.string(), { minLength: 1, maxLength: 3 })),
        (claimId, assignTo) => {
          const parsed = assignSchema.safeParse({ claimId, assignTo })
          expect(parsed.success).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })
})