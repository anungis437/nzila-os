import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { forgotPasswordBodySchema } from '../../app/api/auth/forgot-password/schemas'
import { magicLinkRequestBodySchema } from '../../app/api/auth/magic-link/request/schemas'

const zodSafeEmailArb = fc
  .tuple(
    fc.stringMatching(/^[a-z0-9]{1,16}$/),
    fc.stringMatching(/^[a-z0-9]{1,12}$/),
    fc.stringMatching(/^[a-z]{2,8}$/),
  )
  .map(([local, domain, tld]) => `${local}@${domain}.${tld}`)

describe('auth request schema fuzzing', () => {
  it('accepts valid forgot-password payloads', () => {
    fc.assert(
      fc.property(zodSafeEmailArb, (email) => {
        const parsed = forgotPasswordBodySchema.safeParse({ email })
        expect(parsed.success).toBe(true)
      }),
      { numRuns: 120 },
    )
  })

  it('rejects malformed forgot-password payloads', () => {
    fc.assert(
      fc.property(
        fc.string().filter((value) => !value.includes('@')),
        (email) => {
          const parsed = forgotPasswordBodySchema.safeParse({ email })
          expect(parsed.success).toBe(false)
        },
      ),
      { numRuns: 120 },
    )
  })

  it('accepts valid magic-link request payloads', () => {
    fc.assert(
      fc.property(
        zodSafeEmailArb,
        fc.option(fc.uuid(), { nil: undefined }),
        (email, organizationId) => {
          const payload = organizationId === undefined ? { email } : { email, organizationId }
          const parsed = magicLinkRequestBodySchema.safeParse(payload)
          expect(parsed.success).toBe(true)
        },
      ),
      { numRuns: 120 },
    )
  })

  it('rejects magic-link payloads with invalid organization ids', () => {
    fc.assert(
      fc.property(
        zodSafeEmailArb,
        fc.string().filter((value) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)),
        (email, organizationId) => {
          const parsed = magicLinkRequestBodySchema.safeParse({ email, organizationId })
          expect(parsed.success).toBe(false)
        },
      ),
      { numRuns: 120 },
    )
  })
})