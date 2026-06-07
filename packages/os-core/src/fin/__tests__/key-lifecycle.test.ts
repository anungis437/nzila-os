import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  computeKeyAgeDays,
  isKeyExpired,
  auditKeyAges,
  collectKeyRotationArtifact,
  validateDualControlFinancial,
  createFinancialApproval,
  generateDRSimulationArtifact,
  KEY_AGE_THRESHOLDS,
  DUAL_CONTROL_REQUIRED,
  type FinancialActionType,
  type KeyMetadata,
  type DualControlRequest,
  type KeyRotationEvent,
  type DRSimulationResult,
} from '../key-lifecycle'

describe('key-lifecycle', () => {
  const now = new Date('2026-06-15T00:00:00Z')

  const activeKey: KeyMetadata = {
    keyId: 'k1',
    purpose: 'evidence-signing',
    algorithm: 'AES-256',
    createdAt: '2026-06-01T00:00:00Z',
    rotatedAt: null,
    expiresAt: '2026-09-01T00:00:00Z',
    status: 'active',
    rotationCount: 0,
  }

  describe('computeKeyAgeDays', () => {
    it('computes age from createdAt when no rotation', () => {
      const days = computeKeyAgeDays(activeKey, now)
      expect(days).toBe(14) // Jun 1 → Jun 15
    })

    it('computes age from rotatedAt when present', () => {
      const key: KeyMetadata = {
        ...activeKey,
        rotatedAt: '2026-06-10T00:00:00Z',
      }
      const days = computeKeyAgeDays(key, now)
      expect(days).toBe(5) // Jun 10 → Jun 15
    })
  })

  describe('isKeyExpired', () => {
    it('returns false for a fresh key', () => {
      expect(isKeyExpired(activeKey, now)).toBe(false)
    })

    it('returns true when key exceeds threshold', () => {
      const oldKey: KeyMetadata = {
        ...activeKey,
        createdAt: '2026-01-01T00:00:00Z', // 165 days ago > 90 threshold
      }
      expect(isKeyExpired(oldKey, now)).toBe(true)
    })

    it('respects purpose-specific thresholds', () => {
      const sessionKey: KeyMetadata = {
        ...activeKey,
        purpose: 'session-signing', // threshold = 30 days
        createdAt: '2026-05-01T00:00:00Z', // 45 days ago
      }
      expect(isKeyExpired(sessionKey, now)).toBe(true)
    })
  })

  describe('auditKeyAges', () => {
    it('passes when all keys are fresh', () => {
      const result = auditKeyAges([activeKey], now)
      expect(result.passed).toBe(true)
      expect(result.violations).toHaveLength(0)
    })

    it('reports violations for expired keys', () => {
      const oldKey: KeyMetadata = {
        ...activeKey,
        keyId: 'k-old',
        createdAt: '2025-01-01T00:00:00Z',
      }
      const result = auditKeyAges([activeKey, oldKey], now)
      expect(result.passed).toBe(false)
      expect(result.violations).toHaveLength(1)
      expect(result.violations[0]!.keyId).toBe('k-old')
      expect(result.violations[0]!.overageBy).toBeGreaterThan(0)
    })

    it('skips retired and compromised keys', () => {
      const retired: KeyMetadata = {
        ...activeKey,
        status: 'retired',
        createdAt: '2020-01-01T00:00:00Z',
      }
      expect(auditKeyAges([retired], now).passed).toBe(true)
    })
  })

  describe('collectKeyRotationArtifact', () => {
    it('produces artifact with digest', () => {
      const event: KeyRotationEvent = {
        eventId: 'evt-1',
        keyId: 'k1',
        oldKeyId: null,
        action: 'create',
        performedBy: 'admin',
        approvedBy: null,
        timestamp: '2026-06-15T00:00:00Z',
        evidenceHash: 'abc',
      }
      const art = collectKeyRotationArtifact(event)
      expect(art.artifactId).toContain('kr-k1-create')
      expect(art.digest).toMatch(/^[0-9a-f]{64}$/)
      expect(JSON.parse(art.payload).eventId).toBe('evt-1')
    })
  })

  describe('KEY_AGE_THRESHOLDS', () => {
    it('covers all key purposes', () => {
      expect(KEY_AGE_THRESHOLDS['evidence-signing']).toBe(90)
      expect(KEY_AGE_THRESHOLDS['session-signing']).toBe(30)
      expect(KEY_AGE_THRESHOLDS['api-encryption']).toBe(365)
    })
  })

  describe('validateDualControlFinancial', () => {
    const request: DualControlRequest = {
      actionId: 'act-1',
      actionType: 'payment-disbursement',
      orgId: 'org-1',
      requestedBy: 'alice',
      requestedAt: '2026-06-15T00:00:00Z',
      amount: 10000,
      description: 'Vendor payment',
    }

    it('rejects unknown action types', () => {
      const result = validateDualControlFinancial(
          { ...request, actionType: 'unknown' as FinancialActionType },
        [],
      )
      expect(result.authorized).toBe(false)
      expect(result.reason).toContain('Unknown action type')
    })

    it('rejects when no approvals', () => {
      const result = validateDualControlFinancial(request, [])
      expect(result.authorized).toBe(false)
      expect(result.reason).toContain('requires at least one')
    })

    it('rejects self-approval', () => {
      const approval = createFinancialApproval('act-1', 'alice')
      const result = validateDualControlFinancial(request, [approval])
      expect(result.authorized).toBe(false)
      expect(result.reason).toContain('Self-approval forbidden')
    })

    it('rejects mismatched action IDs', () => {
      const approval = createFinancialApproval('act-WRONG', 'bob')
      const result = validateDualControlFinancial(request, [approval])
      expect(result.authorized).toBe(false)
      expect(result.reason).toContain('action ID mismatch')
    })

    it('authorizes valid dual-control approval', () => {
      const approval = createFinancialApproval('act-1', 'bob')
      const result = validateDualControlFinancial(request, [approval])
      expect(result.authorized).toBe(true)
    })

    it('rejects tampered approval hash', () => {
      const approval = createFinancialApproval('act-1', 'bob')
      approval.approvalHash = 'tampered'
      const result = validateDualControlFinancial(request, [approval])
      expect(result.authorized).toBe(false)
      expect(result.reason).toContain('hash verification failed')
    })
  })

  describe('createFinancialApproval', () => {
    it('creates a signed approval', () => {
      const approval = createFinancialApproval('act-1', 'bob')
      expect(approval.actionId).toBe('act-1')
      expect(approval.approvedBy).toBe('bob')
      expect(approval.approvalHash).toMatch(/^[0-9a-f]{64}$/)
      expect(approval.approvedAt).toBeDefined()
    })
  })

  describe('DUAL_CONTROL_REQUIRED', () => {
    it('includes all financial action types', () => {
      expect(DUAL_CONTROL_REQUIRED).toContain('payment-disbursement')
      expect(DUAL_CONTROL_REQUIRED).toContain('refund')
      expect(DUAL_CONTROL_REQUIRED).toContain('key-rotation')
      expect(DUAL_CONTROL_REQUIRED).toContain('ledger-correction')
    })
  })

  describe('generateDRSimulationArtifact', () => {
    it('generates a deterministic digest', () => {
      const result: DRSimulationResult = {
        simulationId: 'sim-1',
        orgId: 'org-1',
        scenario: 'key-compromise-rotation',
        startedAt: '2026-06-15T00:00:00Z',
        completedAt: '2026-06-15T00:10:00Z',
        passed: true,
        failedSteps: [],
        recoveryTimeSeconds: 600,
        artifactDigest: '',
      }
      const art = generateDRSimulationArtifact(result)
      expect(art.digest).toMatch(/^[0-9a-f]{64}$/)
      // Deterministic
      expect(generateDRSimulationArtifact(result).digest).toBe(art.digest)
    })
  })
})
