/**
 * Nzila OS — ABR Insights Confidential Reporting Model
 *
 * Implements the confidential reporting system for ABR Insights:
 *   1. Separate identity vault with encryption at rest
 *   2. Need-to-know case access control
 *   3. Dual-control for: case close, severity change, identity unmask
 *
 * This module is part of the @nzila/os-core platform layer.
 * App code accesses it through the ABR SDK only.
 */
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

// ── Identity Vault ──────────────────────────────────────────────────────────

export interface IdentityVaultEntry {
  /** Opaque vault entry ID (not correlated to case) */
  vaultId: string
  /** Encrypted identity data (AES-256-GCM) */
  encryptedPayload: string
  /** Initialization vector for decryption */
  iv: string
  /** Auth tag for GCM */
  authTag: string
  /** Key ID used for encryption (for rotation) */
  keyId: string
  /** ISO timestamp */
  createdAt: string
}

export interface IdentityPayload {
  reporterName?: string
  reporterEmail?: string
  reporterPhone?: string
  reporterEmployeeId?: string
  additionalIdentifiers?: Record<string, string>
}

/**
 * Encrypt identity data for vault storage.
 * Uses AES-256-GCM with random IV.
 */
export function encryptIdentity(
  payload: IdentityPayload,
  encryptionKey: Buffer,
  keyId: string,
): Omit<IdentityVaultEntry, 'vaultId' | 'createdAt'> {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv)
  const plaintext = JSON.stringify(payload)

  let encrypted = cipher.update(plaintext, 'utf-8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')

  return {
    encryptedPayload: encrypted,
    iv: iv.toString('hex'),
    authTag,
    keyId,
  }
}

/**
 * Decrypt identity data from vault.
 * Requires the original encryption key and auth tag.
 */
export function decryptIdentity(
  entry: Pick<IdentityVaultEntry, 'encryptedPayload' | 'iv' | 'authTag'>,
  encryptionKey: Buffer,
): IdentityPayload {
  const iv = Buffer.from(entry.iv, 'hex')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey, iv)
  decipher.setAuthTag(Buffer.from(entry.authTag, 'hex'))

  let decrypted = decipher.update(entry.encryptedPayload, 'hex', 'utf-8')
  decrypted += decipher.final('utf-8')

  return JSON.parse(decrypted)
}

// ── Need-to-Know Access Control ─────────────────────────────────────────────

export type CaseAccessLevel = 'none' | 'metadata-only' | 'case-details' | 'identity-access'

export interface CaseAccessGrant {
  userId: string
  caseId: string
  accessLevel: CaseAccessLevel
  grantedBy: string
  grantedAt: string
  expiresAt?: string
  reason: string
}

export interface CaseAccessPolicy {
  /** Who can see case metadata (title, status, severity) */
  metadataAccess: string[] // role IDs
  /** Who can see case details (description, evidence) */
  detailsAccess: string[] // role IDs
  /** Who can unmask reporter identity — requires dual-control */
  identityAccess: string[] // role IDs (must be ≥2 for dual-control)
}

const DEFAULT_ACCESS_POLICY: CaseAccessPolicy = {
  metadataAccess: ['case-manager', 'compliance-officer', 'admin'],
  detailsAccess: ['case-manager', 'compliance-officer'],
  identityAccess: ['compliance-officer', 'admin'],
}

/**
 * Evaluate whether a user has access to a specific case at a given level.
 */
export function evaluateCaseAccess(
  userId: string,
  userRoles: string[],
  requestedLevel: CaseAccessLevel,
  grants: CaseAccessGrant[],
  policy: CaseAccessPolicy = DEFAULT_ACCESS_POLICY,
): { allowed: boolean; reason: string } {
  // Identity access always requires explicit grant (dual-control enforced elsewhere)
  if (requestedLevel === 'identity-access') {
    const grant = grants.find(
      (g) =>
        g.userId === userId &&
        g.accessLevel === 'identity-access' &&
        (!g.expiresAt || new Date(g.expiresAt) > new Date()),
    )
    if (!grant) {
      return {
        allowed: false,
        reason: 'Identity access requires an explicit dual-control grant',
      }
    }
    return { allowed: true, reason: `Granted by ${grant.grantedBy}: ${grant.reason}` }
  }

  // Case details
  if (requestedLevel === 'case-details') {
    const hasRole = userRoles.some((r) => policy.detailsAccess.includes(r))
    return hasRole
      ? { allowed: true, reason: 'Role grants case-details access' }
      : { allowed: false, reason: 'User role does not grant case-details access' }
  }

  // Metadata
  if (requestedLevel === 'metadata-only') {
    const hasRole = userRoles.some((r) => policy.metadataAccess.includes(r))
    return hasRole
      ? { allowed: true, reason: 'Role grants metadata access' }
      : { allowed: false, reason: 'User role does not grant metadata access' }
  }

  return { allowed: false, reason: 'No access level matched' }
}

// ── Dual-Control Operations ─────────────────────────────────────────────────

export type DualControlAction = 'case-close' | 'severity-change' | 'identity-unmask'

export interface DualControlRequest {
  action: DualControlAction
  caseId: string
  requestedBy: string
  requestedAt: string
  justification: string
}

export interface DualControlApproval {
  requestId: string
  approvedBy: string
  approvedAt: string
  notes?: string
}

export interface DualControlResult {
  approved: boolean
  requestedBy: string
  approvedBy?: string
  action: DualControlAction
  caseId: string
}

/**
 * Validate a dual-control operation.
 * The requester and approver MUST be different people.
 * Both must have the required role.
 */
export function validateDualControl(
  request: DualControlRequest,
  approval: DualControlApproval | null,
  requiredRoles: string[],
  requestorRoles: string[],
  approverRoles: string[],
): DualControlResult {
  // Requester must have a valid role
  if (!requestorRoles.some((r) => requiredRoles.includes(r))) {
    return {
      approved: false,
      requestedBy: request.requestedBy,
      action: request.action,
      caseId: request.caseId,
    }
  }

  // Must have an approval
  if (!approval) {
    return {
      approved: false,
      requestedBy: request.requestedBy,
      action: request.action,
      caseId: request.caseId,
    }
  }

  // Approver must be a different person
  if (approval.approvedBy === request.requestedBy) {
    return {
      approved: false,
      requestedBy: request.requestedBy,
      approvedBy: approval.approvedBy,
      action: request.action,
      caseId: request.caseId,
    }
  }

  // Approver must have a valid role
  if (!approverRoles.some((r) => requiredRoles.includes(r))) {
    return {
      approved: false,
      requestedBy: request.requestedBy,
      approvedBy: approval.approvedBy,
      action: request.action,
      caseId: request.caseId,
    }
  }

  return {
    approved: true,
    requestedBy: request.requestedBy,
    approvedBy: approval.approvedBy,
    action: request.action,
    caseId: request.caseId,
  }
}
