/**
 * Red-Team — ABR Insights Confidential Reporting Adversarial Tests
 *
 * Tests that ABR-specific attack vectors are blocked:
 *   1. Metadata inference attack (correlation between case timing and identity)
 *   2. Unauthorized identity access without dual-control grant
 *   3. Self-approval dual-control bypass
 *
 * @security RED-TEAM-ABR-001 through RED-TEAM-ABR-003
 */
import { describe, it, expect } from 'vitest'
import { randomBytes } from 'node:crypto'
import {
  encryptIdentity,
  decryptIdentity,
  evaluateCaseAccess,
  validateDualControl,
  type IdentityPayload,
  type CaseAccessGrant,
  type DualControlRequest,
  type DualControlApproval,
} from '../../packages/os-core/src/abr/confidential-reporting'

// ── RED-TEAM-ABR-001: Metadata Inference Attack ─────────────────────────────

describe('RED-TEAM-ABR-001 — Metadata inference attack resistance', () => {
  it('encrypted identity data leaks no plaintext', () => {
    const key = randomBytes(32)
    const payload: IdentityPayload = {
      reporterName: 'John Confidential',
      reporterEmail: 'john.confidential@example.com',
      reporterEmployeeId: 'EMP-12345',
    }

    const encrypted = encryptIdentity(payload, key, 'key-001')

    // Encrypted payload must not contain plaintext
    expect(encrypted.encryptedPayload).not.toContain('John')
    expect(encrypted.encryptedPayload).not.toContain('confidential')
    expect(encrypted.encryptedPayload).not.toContain('EMP-12345')
    expect(encrypted.encryptedPayload).not.toContain('example.com')
  })

  it('different encryptions of the same data produce different ciphertext', () => {
    const key = randomBytes(32)
    const payload: IdentityPayload = { reporterName: 'Same Person' }

    const enc1 = encryptIdentity(payload, key, 'key-001')
    const enc2 = encryptIdentity(payload, key, 'key-001')

    // IVs must differ → ciphertext must differ
    expect(enc1.iv).not.toBe(enc2.iv)
    expect(enc1.encryptedPayload).not.toBe(enc2.encryptedPayload)
  })

  it('decryption with wrong key fails', () => {
    const correctKey = randomBytes(32)
    const wrongKey = randomBytes(32)
    const payload: IdentityPayload = { reporterName: 'Secret Identity' }

    const encrypted = encryptIdentity(payload, correctKey, 'key-001')

    expect(() =>
      decryptIdentity(encrypted, wrongKey),
    ).toThrow()
  })
})

// ── RED-TEAM-ABR-002: Unauthorized Identity Access ──────────────────────────

describe('RED-TEAM-ABR-002 — Unauthorized identity access blocked', () => {
  it('user without identity-access grant is denied', () => {
    const result = evaluateCaseAccess(
      'user-attacker',
      ['case-manager'],
      'identity-access',
      [], // no grants
    )
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('dual-control grant')
  })

  it('expired grant is rejected', () => {
    const expiredGrant: CaseAccessGrant = {
      userId: 'user-attacker',
      caseId: 'case-001',
      accessLevel: 'identity-access',
      grantedBy: 'admin-001',
      grantedAt: '2025-01-01T00:00:00Z',
      expiresAt: '2025-01-02T00:00:00Z', // expired
      reason: 'Investigation',
    }

    const result = evaluateCaseAccess(
      'user-attacker',
      ['compliance-officer'],
      'identity-access',
      [expiredGrant],
    )
    expect(result.allowed).toBe(false)
  })

  it('user without metadata role cannot see case metadata', () => {
    const result = evaluateCaseAccess(
      'random-user',
      ['viewer'], // not in metadataAccess
      'metadata-only',
      [],
    )
    expect(result.allowed).toBe(false)
  })
})

// ── RED-TEAM-ABR-003: Dual-Control Self-Approval Bypass ─────────────────────

describe('RED-TEAM-ABR-003 — Dual-control self-approval is blocked', () => {
  const request: DualControlRequest = {
    action: 'identity-unmask',
    caseId: 'case-001',
    requestedBy: 'user-alice',
    requestedAt: new Date().toISOString(),
    justification: 'Investigation requires identity disclosure',
  }

  it('same-person approval is rejected', () => {
    const selfApproval: DualControlApproval = {
      requestId: 'req-001',
      approvedBy: 'user-alice', // same as requester
      approvedAt: new Date().toISOString(),
    }

    const result = validateDualControl(
      request,
      selfApproval,
      ['compliance-officer'],
      ['compliance-officer'],
      ['compliance-officer'],
    )
    expect(result.approved).toBe(false)
  })

  it('approval without required role is rejected', () => {
    const unauthorizedApproval: DualControlApproval = {
      requestId: 'req-001',
      approvedBy: 'user-bob',
      approvedAt: new Date().toISOString(),
    }

    const result = validateDualControl(
      request,
      unauthorizedApproval,
      ['compliance-officer'],
      ['compliance-officer'],
      ['viewer'], // bob doesn't have the role
    )
    expect(result.approved).toBe(false)
  })

  it('valid dual-control with different principals succeeds', () => {
    const validApproval: DualControlApproval = {
      requestId: 'req-001',
      approvedBy: 'user-bob',
      approvedAt: new Date().toISOString(),
    }

    const result = validateDualControl(
      request,
      validApproval,
      ['compliance-officer'],
      ['compliance-officer'],
      ['compliance-officer'],
    )
    expect(result.approved).toBe(true)
    expect(result.requestedBy).toBe('user-alice')
    expect(result.approvedBy).toBe('user-bob')
  })

  it('missing approval is rejected', () => {
    const result = validateDualControl(
      request,
      null,
      ['compliance-officer'],
      ['compliance-officer'],
      [],
    )
    expect(result.approved).toBe(false)
  })
})
