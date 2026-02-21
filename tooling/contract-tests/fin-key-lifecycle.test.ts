/**
 * Contract Test — Financial Key Lifecycle & Dual Control
 *
 * INV-19 — Key age governance gate
 * INV-20 — Dual-control for financial actions (no self-approval)
 * INV-21 — DR simulation artifact integrity
 */
import { describe, it, expect } from 'vitest'
import {
  computeKeyAgeDays,
  isKeyExpired,
  auditKeyAges,
  KEY_AGE_THRESHOLDS,
  validateDualControlFinancial,
  createFinancialApproval,
  collectKeyRotationArtifact,
  generateDRSimulationArtifact,
  DUAL_CONTROL_REQUIRED,
} from '../../packages/os-core/src/fin/key-lifecycle'
import type { KeyMetadata, DualControlRequest, DRSimulationResult } from '../../packages/os-core/src/fin/key-lifecycle'

describe('INV-19 — Key age governance gate', () => {
  const now = new Date('2025-06-15T00:00:00Z')

  function makeKey(overrides: Partial<KeyMetadata>): KeyMetadata {
    return {
      keyId: 'key-1',
      purpose: 'evidence-signing',
      algorithm: 'AES-256-GCM',
      createdAt: '2025-01-01T00:00:00Z',
      rotatedAt: null,
      expiresAt: '2026-01-01T00:00:00Z',
      status: 'active',
      rotationCount: 0,
      ...overrides,
    }
  }

  it('computes key age from creation date', () => {
    const key = makeKey({ createdAt: '2025-06-01T00:00:00Z' })
    expect(computeKeyAgeDays(key, now)).toBe(14)
  })

  it('computes key age from last rotation date', () => {
    const key = makeKey({
      createdAt: '2024-01-01T00:00:00Z',
      rotatedAt: '2025-06-10T00:00:00Z',
    })
    expect(computeKeyAgeDays(key, now)).toBe(5)
  })

  it('marks key as expired when over threshold', () => {
    // evidence-signing threshold is 90 days
    const key = makeKey({
      purpose: 'evidence-signing',
      createdAt: '2025-01-01T00:00:00Z', // ~165 days ago
    })
    expect(isKeyExpired(key, now)).toBe(true)
  })

  it('marks key as valid when within threshold', () => {
    const key = makeKey({
      purpose: 'evidence-signing',
      rotatedAt: '2025-06-01T00:00:00Z', // 14 days ago
    })
    expect(isKeyExpired(key, now)).toBe(false)
  })

  it('auditKeyAges returns violations for expired keys', () => {
    const keys: KeyMetadata[] = [
      makeKey({ keyId: 'k1', purpose: 'session-signing', createdAt: '2025-01-01T00:00:00Z' }),
      makeKey({ keyId: 'k2', purpose: 'evidence-signing', rotatedAt: '2025-06-10T00:00:00Z' }),
    ]

    const result = auditKeyAges(keys, now)
    expect(result.passed).toBe(false)
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0].keyId).toBe('k1')
    expect(result.violations[0].purpose).toBe('session-signing')
  })

  it('auditKeyAges skips retired keys', () => {
    const keys: KeyMetadata[] = [
      makeKey({ keyId: 'k1', status: 'retired', createdAt: '2020-01-01T00:00:00Z' }),
    ]
    expect(auditKeyAges(keys, now).passed).toBe(true)
  })

  it('all key purposes have defined thresholds', () => {
    const purposes = [
      'evidence-signing',
      'audit-signing',
      'identity-vault',
      'api-encryption',
      'session-signing',
      'payment-encryption',
    ] as const

    for (const purpose of purposes) {
      expect(KEY_AGE_THRESHOLDS[purpose]).toBeGreaterThan(0)
    }
  })
})

describe('INV-20 — Dual-control for financial actions', () => {
  const baseRequest: DualControlRequest = {
    actionId: 'act-001',
    actionType: 'payment-disbursement',
    entityId: 'entity-abc',
    requestedBy: 'user-A',
    requestedAt: '2025-06-15T12:00:00Z',
    amount: 50000,
    currency: 'USD',
    description: 'Quarterly disbursement',
  }

  it('rejects action with no approvals', () => {
    const result = validateDualControlFinancial(baseRequest, [])
    expect(result.authorized).toBe(false)
    expect(result.reason).toContain('requires at least one independent approval')
  })

  it('rejects self-approval', () => {
    const approval = createFinancialApproval('act-001', 'user-A')
    const result = validateDualControlFinancial(baseRequest, [approval])
    expect(result.authorized).toBe(false)
    expect(result.reason).toContain('Self-approval forbidden')
  })

  it('approves with valid independent approver', () => {
    const approval = createFinancialApproval('act-001', 'user-B')
    const result = validateDualControlFinancial(baseRequest, [approval])
    expect(result.authorized).toBe(true)
  })

  it('rejects approval with mismatched action ID', () => {
    const approval = createFinancialApproval('act-WRONG', 'user-B')
    const result = validateDualControlFinancial(baseRequest, [approval])
    expect(result.authorized).toBe(false)
    expect(result.reason).toContain('action ID mismatch')
  })

  it('rejects approval with tampered hash', () => {
    const approval = createFinancialApproval('act-001', 'user-B')
    approval.approvalHash = 'tampered-hash'
    const result = validateDualControlFinancial(baseRequest, [approval])
    expect(result.authorized).toBe(false)
    expect(result.reason).toContain('hash verification failed')
  })

  it('all financial action types require dual control', () => {
    const expectedTypes = [
      'payment-disbursement',
      'refund',
      'account-adjustment',
      'key-rotation',
      'rate-change',
      'ledger-correction',
    ]
    for (const t of expectedTypes) {
      expect(DUAL_CONTROL_REQUIRED).toContain(t)
    }
  })
})

describe('INV-21 — Key rotation & DR artifacts', () => {
  it('key rotation artifact has deterministic digest', () => {
    const event = {
      eventId: 'evt-1',
      keyId: 'k-new',
      oldKeyId: 'k-old',
      action: 'rotate' as const,
      performedBy: 'admin',
      approvedBy: 'security-lead',
      timestamp: '2025-06-15T00:00:00Z',
      evidenceHash: 'abc123',
    }

    const a1 = collectKeyRotationArtifact(event)
    const a2 = collectKeyRotationArtifact(event)
    expect(a1.digest).toBe(a2.digest)
    expect(a1.digest).toHaveLength(64) // SHA-256 hex
  })

  it('DR simulation artifact generates valid digest', () => {
    const result: DRSimulationResult = {
      simulationId: 'sim-1',
      entityId: 'entity-abc',
      scenario: 'key-compromise-rotation',
      startedAt: '2025-06-15T00:00:00Z',
      completedAt: '2025-06-15T00:05:00Z',
      passed: true,
      failedSteps: [],
      recoveryTimeSeconds: 300,
      artifactDigest: '',
    }

    const artifact = generateDRSimulationArtifact(result)
    expect(artifact.digest).toHaveLength(64)
    expect(JSON.parse(artifact.payload)).toHaveProperty('scenario', 'key-compromise-rotation')
  })

  it('DR simulation artifact changes when result differs', () => {
    const base: DRSimulationResult = {
      simulationId: 'sim-1',
      entityId: 'entity-abc',
      scenario: 'key-compromise-rotation',
      startedAt: '2025-06-15T00:00:00Z',
      completedAt: '2025-06-15T00:05:00Z',
      passed: true,
      failedSteps: [],
      recoveryTimeSeconds: 300,
      artifactDigest: '',
    }

    const a1 = generateDRSimulationArtifact(base)
    const a2 = generateDRSimulationArtifact({ ...base, passed: false, failedSteps: ['step-3'] })
    expect(a1.digest).not.toBe(a2.digest)
  })
})
