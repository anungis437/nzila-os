/**
 * Tests for abr/confidential-reporting.ts — Identity vault + access control + dual-control
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
  type CaseAccessPolicy,
  type DualControlRequest,
  type DualControlApproval,
} from '../confidential-reporting'

// ── Identity Vault (Encryption) ───────────────────────────────────────────

describe('encryptIdentity / decryptIdentity', () => {
  const key = randomBytes(32) // AES-256
  const keyId = 'key-001'

  const payload: IdentityPayload = {
    reporterName: 'Jane Doe',
    reporterEmail: 'jane@example.com',
    reporterPhone: '+1-555-1234',
    reporterEmployeeId: 'EMP-001',
    additionalIdentifiers: { department: 'Legal' },
  }

  it('encrypts and decrypts identity data round-trip', () => {
    const encrypted = encryptIdentity(payload, key, keyId)

    expect(encrypted.encryptedPayload).toBeTruthy()
    expect(encrypted.iv).toBeTruthy()
    expect(encrypted.authTag).toBeTruthy()
    expect(encrypted.keyId).toBe(keyId)
    // Encrypted payload should not contain plaintext
    expect(encrypted.encryptedPayload).not.toContain('Jane Doe')

    const decrypted = decryptIdentity(encrypted, key)
    expect(decrypted).toEqual(payload)
  })

  it('produces different ciphertext for the same plaintext (random IV)', () => {
    const a = encryptIdentity(payload, key, keyId)
    const b = encryptIdentity(payload, key, keyId)
    expect(a.encryptedPayload).not.toBe(b.encryptedPayload)
    expect(a.iv).not.toBe(b.iv)
  })

  it('decrypts minimal payload (only one field)', () => {
    const minimal: IdentityPayload = { reporterName: 'Minimal' }
    const encrypted = encryptIdentity(minimal, key, keyId)
    const decrypted = decryptIdentity(encrypted, key)
    expect(decrypted.reporterName).toBe('Minimal')
    expect(decrypted.reporterEmail).toBeUndefined()
  })

  it('throws on decryption with wrong key', () => {
    const encrypted = encryptIdentity(payload, key, keyId)
    const wrongKey = randomBytes(32)
    expect(() => decryptIdentity(encrypted, wrongKey)).toThrow()
  })

  it('throws on decryption with tampered ciphertext', () => {
    const encrypted = encryptIdentity(payload, key, keyId)
    // Flip a byte in the encrypted payload
    const tampered = encrypted.encryptedPayload.substring(0, 4) + 'ff' + encrypted.encryptedPayload.substring(6)
    expect(() => decryptIdentity({ ...encrypted, encryptedPayload: tampered }, key)).toThrow()
  })

  it('throws on decryption with tampered authTag', () => {
    const encrypted = encryptIdentity(payload, key, keyId)
    const tampered = '00'.repeat(16) // 16-byte tag
    expect(() => decryptIdentity({ ...encrypted, authTag: tampered }, key)).toThrow()
  })
})

// ── Need-to-Know Access Control ───────────────────────────────────────────

describe('evaluateCaseAccess', () => {
  const userId = 'user-1'
  const now = new Date().toISOString()

  it('grants metadata access when user has matching role', () => {
    const result = evaluateCaseAccess(userId, ['case-manager'], 'metadata-only', [])
    expect(result.allowed).toBe(true)
    expect(result.reason).toContain('metadata access')
  })

  it('denies metadata access when role does not match', () => {
    const result = evaluateCaseAccess(userId, ['viewer'], 'metadata-only', [])
    expect(result.allowed).toBe(false)
  })

  it('grants case-details access for compliance-officer', () => {
    const result = evaluateCaseAccess(userId, ['compliance-officer'], 'case-details', [])
    expect(result.allowed).toBe(true)
    expect(result.reason).toContain('case-details access')
  })

  it('denies case-details for case-manager (not in detailsAccess)', () => {
    const result = evaluateCaseAccess(userId, ['case-manager'], 'case-details', [])
    expect(result.allowed).toBe(false)
  })

  it('denies identity-access without explicit grant', () => {
    const result = evaluateCaseAccess(userId, ['compliance-officer', 'admin'], 'identity-access', [])
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('dual-control')
  })

  it('grants identity-access with valid grant', () => {
    const grants: CaseAccessGrant[] = [
      {
        userId: 'user-1',
        caseId: 'case-001',
        accessLevel: 'identity-access',
        grantedBy: 'admin-1',
        grantedAt: now,
        reason: 'Investigation requires identity',
      },
    ]
    const result = evaluateCaseAccess(userId, ['compliance-officer'], 'identity-access', grants)
    expect(result.allowed).toBe(true)
    expect(result.reason).toContain('admin-1')
  })

  it('denies identity-access when grant is expired', () => {
    const pastDate = new Date(Date.now() - 86400_000).toISOString()
    const grants: CaseAccessGrant[] = [
      {
        userId: 'user-1',
        caseId: 'case-001',
        accessLevel: 'identity-access',
        grantedBy: 'admin-1',
        grantedAt: now,
        expiresAt: pastDate,
        reason: 'Expired grant',
      },
    ]
    const result = evaluateCaseAccess(userId, ['compliance-officer'], 'identity-access', grants)
    expect(result.allowed).toBe(false)
  })

  it('returns no-match for none access level', () => {
    const result = evaluateCaseAccess(userId, ['admin'], 'none', [])
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('No access level matched')
  })

  it('uses custom policy when provided', () => {
    const customPolicy: CaseAccessPolicy = {
      metadataAccess: ['viewer'],
      detailsAccess: ['viewer'],
      identityAccess: ['super-admin'],
    }
    const result = evaluateCaseAccess(userId, ['viewer'], 'case-details', [], customPolicy)
    expect(result.allowed).toBe(true)
  })
})

// ── Dual-Control Operations ─────────────────────────────────────────────────

describe('validateDualControl', () => {
  const request: DualControlRequest = {
    action: 'case-close',
    caseId: 'case-001',
    requestedBy: 'user-A',
    requestedAt: new Date().toISOString(),
    justification: 'Case resolved',
  }

  const approval: DualControlApproval = {
    requestId: 'req-001',
    approvedBy: 'user-B',
    approvedAt: new Date().toISOString(),
  }

  const requiredRoles = ['compliance-officer', 'admin']

  it('approves when requestor and approver are different people with valid roles', () => {
    const result = validateDualControl(request, approval, requiredRoles, ['admin'], ['compliance-officer'])
    expect(result.approved).toBe(true)
    expect(result.requestedBy).toBe('user-A')
    expect(result.approvedBy).toBe('user-B')
    expect(result.action).toBe('case-close')
    expect(result.caseId).toBe('case-001')
  })

  it('rejects when requestor lacks required role', () => {
    const result = validateDualControl(request, approval, requiredRoles, ['viewer'], ['admin'])
    expect(result.approved).toBe(false)
  })

  it('rejects when approval is null', () => {
    const result = validateDualControl(request, null, requiredRoles, ['admin'], [])
    expect(result.approved).toBe(false)
  })

  it('rejects when approver is the same as requestor', () => {
    const samePersonApproval = { ...approval, approvedBy: 'user-A' }
    const result = validateDualControl(request, samePersonApproval, requiredRoles, ['admin'], ['admin'])
    expect(result.approved).toBe(false)
    expect(result.approvedBy).toBe('user-A')
  })

  it('rejects when approver lacks required role', () => {
    const result = validateDualControl(request, approval, requiredRoles, ['admin'], ['viewer'])
    expect(result.approved).toBe(false)
  })

  it('works for identity-unmask action', () => {
    const req: DualControlRequest = { ...request, action: 'identity-unmask' }
    const result = validateDualControl(req, approval, requiredRoles, ['compliance-officer'], ['admin'])
    expect(result.approved).toBe(true)
    expect(result.action).toBe('identity-unmask')
  })

  it('works for severity-change action', () => {
    const req: DualControlRequest = { ...request, action: 'severity-change' }
    const result = validateDualControl(req, approval, requiredRoles, ['admin'], ['compliance-officer'])
    expect(result.approved).toBe(true)
    expect(result.action).toBe('severity-change')
  })
})
