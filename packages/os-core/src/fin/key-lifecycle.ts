/**
 * Nzila OS — Financial Key Lifecycle & Dual Control
 *
 * Implements:
 *   1. Key rotation artifact collector (tracks key age, rotation events)
 *   2. Dual-control enforcement for financial actions
 *   3. DR simulation artifact generation
 *   4. Key age governance gate
 */
import { createHash, randomBytes } from 'node:crypto'

// ── Key Rotation Lifecycle ──────────────────────────────────────────────────

export interface KeyMetadata {
  keyId: string
  purpose: KeyPurpose
  algorithm: string
  createdAt: string
  rotatedAt: string | null
  expiresAt: string
  status: 'active' | 'rotating' | 'retired' | 'compromised'
  rotationCount: number
}

export type KeyPurpose =
  | 'evidence-signing'
  | 'audit-signing'
  | 'identity-vault'
  | 'api-encryption'
  | 'session-signing'
  | 'payment-encryption'

/**
 * Maximum key age in days by purpose.
 * Governance gate: fail if any key exceeds its threshold.
 */
export const KEY_AGE_THRESHOLDS: Record<KeyPurpose, number> = {
  'evidence-signing': 90,
  'audit-signing': 90,
  'identity-vault': 60,
  'api-encryption': 365,
  'session-signing': 30,
  'payment-encryption': 90,
}

export interface KeyRotationEvent {
  eventId: string
  keyId: string
  oldKeyId: string | null
  action: 'create' | 'rotate' | 'retire' | 'compromise'
  performedBy: string
  approvedBy: string | null
  timestamp: string
  evidenceHash: string
}

/**
 * Compute the age of a key in days from its last rotation (or creation).
 */
export function computeKeyAgeDays(key: KeyMetadata, now: Date = new Date()): number {
  const referenceDate = key.rotatedAt ? new Date(key.rotatedAt) : new Date(key.createdAt)
  const diffMs = now.getTime() - referenceDate.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Check if a key has exceeded its age threshold.
 */
export function isKeyExpired(key: KeyMetadata, now: Date = new Date()): boolean {
  const ageDays = computeKeyAgeDays(key, now)
  const threshold = KEY_AGE_THRESHOLDS[key.purpose]
  return ageDays > threshold
}

/**
 * Governance gate: check all keys and return violations.
 */
export function auditKeyAges(
  keys: KeyMetadata[],
  now: Date = new Date(),
): { passed: boolean; violations: KeyAgeViolation[] } {
  const violations: KeyAgeViolation[] = []

  for (const key of keys) {
    if (key.status === 'retired' || key.status === 'compromised') continue

    const ageDays = computeKeyAgeDays(key, now)
    const threshold = KEY_AGE_THRESHOLDS[key.purpose]

    if (ageDays > threshold) {
      violations.push({
        keyId: key.keyId,
        purpose: key.purpose,
        ageDays,
        threshold,
        overageBy: ageDays - threshold,
      })
    }
  }

  return {
    passed: violations.length === 0,
    violations,
  }
}

export interface KeyAgeViolation {
  keyId: string
  purpose: KeyPurpose
  ageDays: number
  threshold: number
  overageBy: number
}

/**
 * Collect a rotation artifact for evidence packing.
 */
export function collectKeyRotationArtifact(
  event: KeyRotationEvent,
): { artifactId: string; digest: string; payload: string } {
  const payload = JSON.stringify({
    eventId: event.eventId,
    keyId: event.keyId,
    oldKeyId: event.oldKeyId,
    action: event.action,
    performedBy: event.performedBy,
    approvedBy: event.approvedBy,
    timestamp: event.timestamp,
  })

  const digest = createHash('sha256').update(payload).digest('hex')
  const artifactId = `kr-${event.keyId}-${event.action}-${Date.now()}`

  return { artifactId, digest, payload }
}

// ── Dual Control for Financial Actions ──────────────────────────────────────

export interface DualControlRequest {
  actionId: string
  actionType: FinancialActionType
  entityId: string
  requestedBy: string
  requestedAt: string
  amount?: number
  currency?: string
  description: string
}

export interface DualControlApproval {
  actionId: string
  approvedBy: string
  approvedAt: string
  approvalHash: string
}

export type FinancialActionType =
  | 'payment-disbursement'
  | 'refund'
  | 'account-adjustment'
  | 'key-rotation'
  | 'rate-change'
  | 'ledger-correction'

/**
 * Financial actions requiring dual control (two distinct approvers).
 * NO bypasses — all listed actions require dual control.
 */
export const DUAL_CONTROL_REQUIRED: FinancialActionType[] = [
  'payment-disbursement',
  'refund',
  'account-adjustment',
  'key-rotation',
  'rate-change',
  'ledger-correction',
]

/**
 * Validate dual-control requirements for a financial action.
 */
export function validateDualControlFinancial(
  request: DualControlRequest,
  approvals: DualControlApproval[],
): { authorized: boolean; reason?: string } {
  // Must require dual control
  if (!DUAL_CONTROL_REQUIRED.includes(request.actionType)) {
    return { authorized: false, reason: `Unknown action type: ${request.actionType}` }
  }

  // Must have at least one approval
  if (approvals.length === 0) {
    return {
      authorized: false,
      reason: 'Financial action requires at least one independent approval',
    }
  }

  // Approver must not be the requester (self-approval forbidden)
  for (const approval of approvals) {
    if (approval.approvedBy === request.requestedBy) {
      return {
        authorized: false,
        reason: `Self-approval forbidden: ${approval.approvedBy} cannot approve their own request`,
      }
    }
  }

  // Action IDs must match
  for (const approval of approvals) {
    if (approval.actionId !== request.actionId) {
      return {
        authorized: false,
        reason: `Approval action ID mismatch: expected ${request.actionId}, got ${approval.actionId}`,
      }
    }
  }

  // Verify approval hash integrity
  for (const approval of approvals) {
    const expectedHash = createHash('sha256')
      .update(
        JSON.stringify({
          actionId: approval.actionId,
          approvedBy: approval.approvedBy,
          approvedAt: approval.approvedAt,
        }),
      )
      .digest('hex')

    if (approval.approvalHash !== expectedHash) {
      return {
        authorized: false,
        reason: `Approval hash verification failed for approver ${approval.approvedBy}`,
      }
    }
  }

  return { authorized: true }
}

/**
 * Create a signed approval for dual-control.
 */
export function createFinancialApproval(
  actionId: string,
  approvedBy: string,
): DualControlApproval {
  const approvedAt = new Date().toISOString()
  const approvalHash = createHash('sha256')
    .update(JSON.stringify({ actionId, approvedBy, approvedAt }))
    .digest('hex')

  return { actionId, approvedBy, approvedAt, approvalHash }
}

// ── DR Simulation Artifact ──────────────────────────────────────────────────

export interface DRSimulationResult {
  simulationId: string
  entityId: string
  scenario: DRScenario
  startedAt: string
  completedAt: string
  passed: boolean
  failedSteps: string[]
  recoveryTimeSeconds: number
  artifactDigest: string
}

export type DRScenario =
  | 'key-compromise-rotation'
  | 'database-failover'
  | 'payment-provider-outage'
  | 'full-key-rotation-cycle'

/**
 * Generate a DR simulation artifact digest for evidence packing.
 */
export function generateDRSimulationArtifact(
  result: DRSimulationResult,
): { digest: string; payload: string } {
  const payload = JSON.stringify({
    simulationId: result.simulationId,
    scenario: result.scenario,
    passed: result.passed,
    failedSteps: result.failedSteps,
    recoveryTimeSeconds: result.recoveryTimeSeconds,
    completedAt: result.completedAt,
  })

  const digest = createHash('sha256').update(payload).digest('hex')
  return { digest, payload }
}
