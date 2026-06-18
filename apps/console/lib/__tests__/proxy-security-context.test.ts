import { afterEach, describe, expect, it } from 'vitest'
import { hasTrustedSecurityContext } from '../security-context'

describe('proxy trusted security context', () => {
  afterEach(() => {
    delete process.env.INTERNAL_CONTEXT_SHARED_SECRET
  })

  it('returns false when shared secret is not configured', () => {
    const req = {
      headers: { get: () => 'any' },
    } as unknown as Parameters<typeof hasTrustedSecurityContext>[0]

    expect(hasTrustedSecurityContext(req)).toBe(false)
  })

  it('returns false when request header does not match secret', () => {
    process.env.INTERNAL_CONTEXT_SHARED_SECRET = 'expected'
    const req = {
      headers: { get: () => 'wrong' },
    } as unknown as Parameters<typeof hasTrustedSecurityContext>[0]

    expect(hasTrustedSecurityContext(req)).toBe(false)
  })

  it('returns true when request header matches secret', () => {
    process.env.INTERNAL_CONTEXT_SHARED_SECRET = 'expected'
    const req = {
      headers: {
        get: (name: string) =>
          name === 'x-internal-context-secret' ? 'expected' : null,
      },
    } as unknown as Parameters<typeof hasTrustedSecurityContext>[0]

    expect(hasTrustedSecurityContext(req)).toBe(true)
  })
})
