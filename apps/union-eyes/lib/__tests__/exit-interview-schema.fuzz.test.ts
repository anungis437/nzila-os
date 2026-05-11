import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { createExitInterviewSchema, listQuerySchema } from '../../app/api/exit-interviews/schemas'

const validRoleArb = fc.constantFrom('member', 'steward', 'chief_steward', 'officer', 'admin')
const validReasonArb = fc.constantFrom('retirement', 'career_change', 'health', 'relocation', 'other')

describe('exit interview schema fuzzing', () => {
  it('accepts valid payloads across varied generated inputs', () => {
    fc.assert(
      fc.property(
        fc.record({
          retiringEmployeeName: fc.string({ minLength: 2, maxLength: 40 }),
          roleInUnion: validRoleArb,
          yearsOfService: fc.integer({ min: 0, max: 80 }),
          retirementReason: fc.option(validReasonArb, { nil: undefined }),
          title: fc.string({ minLength: 5, maxLength: 80 }),
          summary: fc.option(fc.string({ maxLength: 120 }), { nil: undefined }),
          keyLessons: fc.string({ minLength: 10, maxLength: 160 }),
          bestPractices: fc.option(fc.string({ maxLength: 120 }), { nil: undefined }),
          bargainingAdvice: fc.option(fc.string({ maxLength: 120 }), { nil: undefined }),
          mediationAdvice: fc.option(fc.string({ maxLength: 120 }), { nil: undefined }),
          incomingOfficerAdvice: fc.option(fc.string({ maxLength: 120 }), { nil: undefined }),
          topics: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }), {
            nil: undefined,
          }),
          keyCases: fc.option(
            fc.array(
              fc.record({
                id: fc.option(fc.string({ minLength: 1, maxLength: 24 }), { nil: undefined }),
                label: fc.string({ minLength: 1, maxLength: 30 }),
                notes: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
              }),
              { maxLength: 3 },
            ),
            { nil: undefined },
          ),
          containsPii: fc.option(fc.boolean(), { nil: undefined }),
          metadata: fc.option(fc.dictionary(fc.string({ minLength: 1, maxLength: 12 }), fc.string()), {
            nil: undefined,
          }),
        }),
        (payload) => {
          expect(createExitInterviewSchema.safeParse(payload).success).toBe(true)
        },
      ),
      { numRuns: 250 },
    )
  })

  it('rejects structurally invalid payloads', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.record({
            retiringEmployeeName: fc.string({ maxLength: 1 }),
            roleInUnion: fc.constant('member'),
            yearsOfService: fc.integer({ min: 0, max: 80 }),
            title: fc.string({ minLength: 5, maxLength: 20 }),
            keyLessons: fc.string({ minLength: 10, maxLength: 20 }),
          }),
          fc.record({
            retiringEmployeeName: fc.string({ minLength: 2, maxLength: 20 }),
            roleInUnion: fc.constant('member'),
            yearsOfService: fc.oneof(fc.integer({ max: -1 }), fc.integer({ min: 81, max: 200 })),
            title: fc.string({ minLength: 5, maxLength: 20 }),
            keyLessons: fc.string({ minLength: 10, maxLength: 20 }),
          }),
          fc.record({
            retiringEmployeeName: fc.string({ minLength: 2, maxLength: 20 }),
            roleInUnion: fc.constant('member'),
            yearsOfService: fc.integer({ min: 0, max: 80 }),
            title: fc.string({ maxLength: 4 }),
            keyLessons: fc.string({ minLength: 10, maxLength: 20 }),
          }),
          fc.record({
            retiringEmployeeName: fc.string({ minLength: 2, maxLength: 20 }),
            roleInUnion: fc.constant('member'),
            yearsOfService: fc.integer({ min: 0, max: 80 }),
            title: fc.string({ minLength: 5, maxLength: 20 }),
            keyLessons: fc.string({ maxLength: 9 }),
          }),
        ),
        (payload) => {
          expect(createExitInterviewSchema.safeParse(payload).success).toBe(false)
        },
      ),
      { numRuns: 250 },
    )
  })

  it('query schema only accepts supported mine values', () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        const parsed = listQuerySchema.safeParse({ mine: value })
        expect(parsed.success).toBe(value === 'true' || value === 'false')
      }),
      { numRuns: 150 },
    )
  })
})