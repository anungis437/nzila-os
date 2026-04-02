/**
 * Nzila OS — Property-Based Security Tests (fast-check)
 * iSSDLC W2-7: Property-based testing for API input boundaries
 *
 * Uses fast-check for property-based / fuzz-like testing of
 * security-critical input validation functions.
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

// ── Test helpers ─────────────────────────────────────────────────────────────

/** Simulates field sanitization (mirrors grievance-triage.ts logic) */
function sanitizeField(input: string, maxLength: number): string {
  return input
    .replace(/\0/g, '')                    // strip null bytes
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // strip control chars
    .trim()
    .slice(0, maxLength)
}

/** Simulates org ID validation */
function isValidOrgId(orgId: string): boolean {
  return /^org_[a-zA-Z0-9]{10,}$/.test(orgId)
}

/** Simulates rate limit key generation */
function rateLimitKey(userId: string, endpoint: string): string {
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '')
  const safeEndpoint = endpoint.replace(/[^a-zA-Z0-9/_-]/g, '')
  return `rl:${safeUserId}:${safeEndpoint}`
}

// ── Property tests ───────────────────────────────────────────────────────────

describe('PROP-001 — sanitizeField never produces control characters', () => {
  it('output contains no null bytes regardless of input', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = sanitizeField(input, 2000)
        expect(result).not.toContain('\0')
      }),
      { numRuns: 10000 },
    )
  })

  it('output never exceeds max length', () => {
    fc.assert(
      fc.property(fc.string(), fc.integer({ min: 1, max: 10000 }), (input, maxLen) => {
        const result = sanitizeField(input, maxLen)
        expect(result.length).toBeLessThanOrEqual(maxLen)
      }),
      { numRuns: 5000 },
    )
  })

  it('output has no leading/trailing whitespace', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = sanitizeField(input, 2000)
        expect(result).toBe(result.trim())
      }),
      { numRuns: 5000 },
    )
  })
})

describe('PROP-002 — orgId validation rejects injection attempts', () => {
  it('rejects arbitrary strings', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        if (!input.startsWith('org_') || input.length < 14) {
          expect(isValidOrgId(input)).toBe(false)
        }
      }),
      { numRuns: 10000 },
    )
  })

  it('rejects strings with special characters', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom("'", '"', ';', '-', ' ', '<', '>', '&'), { minLength: 1, maxLength: 50 }).map((a) => a.join('')),
        (input) => {
          expect(isValidOrgId(input)).toBe(false)
        },
      ),
      { numRuns: 5000 },
    )
  })

  it('accepts valid org IDs', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 10, maxLength: 30 }).map((a) => a.join('')),
        (suffix) => {
          expect(isValidOrgId(`org_${suffix}`)).toBe(true)
        },
      ),
      { numRuns: 5000 },
    )
  })
})

describe('PROP-003 — rate limit key is injection-safe', () => {
  it('output never contains shell metacharacters', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (userId, endpoint) => {
        const key = rateLimitKey(userId, endpoint)
        expect(key).not.toMatch(/[;|&$`{}()!<>]/)
      }),
      { numRuns: 10000 },
    )
  })

  it('output format is always rl:<userId>:<endpoint>', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (userId, endpoint) => {
        const key = rateLimitKey(userId, endpoint)
        expect(key).toMatch(/^rl:[a-zA-Z0-9_-]*:[a-zA-Z0-9/_-]*$/)
      }),
      { numRuns: 10000 },
    )
  })
})

describe('PROP-004 — SHA-256 hash determinism', () => {
  it('same input always produces same hash', () => {
    const { createHash } = require('node:crypto')
    fc.assert(
      fc.property(fc.string(), (input) => {
        const hash1 = createHash('sha256').update(input).digest('hex')
        const hash2 = createHash('sha256').update(input).digest('hex')
        expect(hash1).toBe(hash2)
      }),
      { numRuns: 5000 },
    )
  })

  it('hash output is always 64 hex characters', () => {
    const { createHash } = require('node:crypto')
    fc.assert(
      fc.property(fc.string(), (input) => {
        const hash = createHash('sha256').update(input).digest('hex')
        expect(hash).toMatch(/^[a-f0-9]{64}$/)
      }),
      { numRuns: 5000 },
    )
  })
})
