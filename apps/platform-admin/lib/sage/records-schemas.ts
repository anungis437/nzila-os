/**
 * Platform Admin — SAGE Phase 8B records-lifecycle schemas (server-only inputs)
 *
 * Strict request validation for the records-lifecycle routes. Every schema is
 * `.strict()` so a client can NEVER smuggle server-derived fields (orgId,
 * workspaceId, actorId, hashes, status, retainUntil, holdCode, etc.). Those are
 * always derived inside the SAGE service layer.
 */
import { z } from 'zod'

export const assignRetentionSchema = z
  .object({
    policyCode: z.string().min(1).max(128),
    eventDate: z.string().datetime().optional(),
    firstDeliveredAt: z.string().datetime().optional(),
  })
  .strict()

export const createRetentionPolicySchema = z
  .object({
    policyCode: z.string().min(1).max(128),
    version: z.number().int().min(1).max(100000),
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    retentionBasis: z.enum(['created_at', 'delivered_at', 'event_date']),
    retentionDurationDays: z.number().int().min(0).max(3_650_000),
    effectiveFrom: z.string().datetime().optional(),
  })
  .strict()

export const placeLegalHoldSchema = z
  .object({
    reason: z.string().min(1).max(2000),
  })
  .strict()

export const releaseLegalHoldSchema = z
  .object({
    releaseReason: z.string().min(1).max(2000),
  })
  .strict()

export const requestDestructionSchema = z
  .object({
    reason: z.string().min(1).max(2000),
  })
  .strict()

export const decideDestructionSchema = z
  .object({
    rationale: z.string().max(2000).optional(),
  })
  .strict()

// ── Browser-safe response shapes (no raw storage references or bytes) ────────
export type SageRetentionAssignmentResponse = {
  id: string
  exportPackageId: string
  policyCode: string
  policyVersion: number
  retentionBasis: string
  retentionStartedAt: string
  retainUntil: string
  assignedAt: string
}

export type SageLegalHoldResponse = {
  id: string
  exportPackageId: string
  status: string
  reason: string
  placedAt: string
  releasedAt: string | null
  releaseReason: string | null
}

export type SageDestructionEligibilityResponse = {
  eligible: boolean
  reasonCodes: string[]
  retainUntil: string | null
  activeHoldCount: number
}

export type SageDestructionRequestResponse = {
  id: string
  exportPackageId: string
  status: string
  reason: string
  packageContentHash: string
  packageManifestHash: string
  storageReferenceHash: string
  retentionPolicyCode: string
  retentionPolicyVersion: number
  retainUntil: string
  activeHoldCount: number
  requestedAt: string
  updatedAt: string
  /** Whether the viewing actor is the requester (approval controls hidden for own request). */
  isOwnRequest: boolean
}

export type SageDestructionEvidenceResponse = {
  id: string
  destructionRequestId: string
  exportPackageId: string
  storageProvider: string
  storageReferenceHash: string
  preDestructionContentHash: string
  preDestructionManifestHash: string
  deletionVerifiedAt: string | null
  verificationMethod: string | null
  result: string
  safeErrorCode: string | null
}
