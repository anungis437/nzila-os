import { describe, expect, it } from 'vitest'
import { canonicalAuditContentHash } from '../canonical-audit-chain'

// Vectors produced by backend/core/services.py compute_content_hash (real Python execution).
describe('canonical audit hash parity with backend/core/services.py', () => {
  it('matches Python for a typical entitlement-denial record with no previous hash', () => {
    expect(
      canonicalAuditContentHash({
        action: 'entitlement_check_failed',
        resourceType: 'entitlement',
        resourceId: '',
        userId: '',
        correlationId: '',
        details: {
          timestamp: '2026-10-15T03:00:00.000Z',
          outcome: 'failure',
          severity: 'error',
          eventType: 'system.security_alert',
          metadata: { reason: 'No active entitlement', featureKey: 'grievance_case_suite' },
        },
        previousHash: null,
      }),
    ).toBe('e54b724d15cc6bf4b015b8249e3bd0c0ae6765a25e563e3bc07bbdf8370f75fb')
  })

  it('matches Python for sorted keys, non-ASCII, astral, control characters and DEL', () => {
    expect(
      canonicalAuditContentHash({
        action: 'data.update',
        resourceType: 'claims',
        resourceId: 'c-1',
        userId: 'u-1',
        correlationId: '',
        details: {
          z: 1,
          a: [1, 2.5, { n: null, '😀': true, é: 'ü' }],
          q: 'line\n"quote"\t\\ \u007f \u0001',
        },
        previousHash: 'a'.repeat(64),
      }),
    ).toBe('ace002b6ee4363ebc47e6c292c8e82ce2a1e16af018dd28367c99e2df28866a9')
  })

  it('rejects values the Python chain cannot represent instead of hashing a different payload', () => {
    expect(() =>
      canonicalAuditContentHash({
        action: 'a',
        resourceType: 'b',
        resourceId: '',
        userId: '',
        correlationId: '',
        details: { bad: Number.NaN },
        previousHash: null,
      }),
    ).toThrow('UE_AUDIT_NON_FINITE_NUMBER')
  })
})
