/**
 * Platform Admin — SAGE Phase 8A secure delivery API schemas (zod)
 *
 * Every request is `.strict()`, so the browser can never smuggle server-derived
 * fields. The following are ALWAYS rejected: orgId, workspaceId (route-derived),
 * requesterId, approverId, issuedBy, revokedBy, status, packageContentHash,
 * packageManifestHash, recipientIdentityHash, invitationTokenHash, sessionToken,
 * actorKind, authenticationType, storageReference, publicUrl.
 */
import { z } from 'zod'
import {
  SAGE_DELIVERY_REVOCATION_REASON_CODES,
  type SageDeliveryRevocationReasonCode,
} from '@nzila/sage-core'

const reasonEnum = z.enum(
  SAGE_DELIVERY_REVOCATION_REASON_CODES as unknown as [
    SageDeliveryRevocationReasonCode,
    ...SageDeliveryRevocationReasonCode[],
  ],
)

// ─── Administrative requests ───────────────────────────────────────────────────

export const CreateDeliveryRecipientRequest = z
  .object({
    displayName: z.string().trim().min(1, 'A recipient name is required').max(400),
    email: z.string().trim().email('A valid recipient email is required').max(320),
  })
  .strict()
export type CreateDeliveryRecipientRequest = z.infer<typeof CreateDeliveryRecipientRequest>

export const CreateDeliveryRequestRequest = z
  .object({
    exportPackageId: z.string().trim().min(1).max(200),
    recipientId: z.string().trim().min(1).max(200),
    purpose: z.string().trim().max(4_000).optional(),
    accessExpiresAt: z.string().datetime({ message: 'A valid access expiry is required' }),
    maxAccesses: z.number().int().min(1).max(100),
  })
  .strict()
export type CreateDeliveryRequestRequest = z.infer<typeof CreateDeliveryRequestRequest>

export const DecideDeliveryRequestRequest = z
  .object({
    rationale: z.string().trim().min(1, 'A decision rationale is required').max(8_000),
  })
  .strict()
export type DecideDeliveryRequestRequest = z.infer<typeof DecideDeliveryRequestRequest>

export const IssueDeliveryInvitationRequest = z.object({}).strict()
export type IssueDeliveryInvitationRequest = z.infer<typeof IssueDeliveryInvitationRequest>

export const RevokeDeliveryGrantRequest = z
  .object({
    revocationReasonCode: reasonEnum,
  })
  .strict()
export type RevokeDeliveryGrantRequest = z.infer<typeof RevokeDeliveryGrantRequest>

// ─── Recipient requests ────────────────────────────────────────────────────────

export const ClaimDeliveryInvitationRequest = z
  .object({
    token: z.string().trim().min(1, 'An invitation token is required').max(512),
    verifiedEmail: z.string().trim().email('A verified email is required').max(320),
  })
  .strict()
export type ClaimDeliveryInvitationRequest = z.infer<typeof ClaimDeliveryInvitationRequest>

// ─── Responses (browser-safe projections) ──────────────────────────────────────

export const SageDeliveryRecipientResponse = z.object({
  id: z.string(),
  displayName: z.string(),
  identityProvider: z.string(),
  verificationStatus: z.string(),
  verifiedAt: z.string().nullable(),
  createdAt: z.string(),
})
export type SageDeliveryRecipientResponse = z.infer<typeof SageDeliveryRecipientResponse>

export const SageDeliveryRequestResponse = z.object({
  id: z.string(),
  exportPackageId: z.string(),
  recipientId: z.string(),
  status: z.string(),
  purpose: z.string().nullable(),
  packageContentHash: z.string(),
  requestedAccessExpiresAt: z.string(),
  requestedMaxAccesses: z.number(),
  requestedAt: z.string(),
})
export type SageDeliveryRequestResponse = z.infer<typeof SageDeliveryRequestResponse>

export const SageDeliveryGrantResponse = z.object({
  id: z.string(),
  deliveryRequestId: z.string(),
  exportPackageId: z.string(),
  recipientId: z.string(),
  status: z.string(),
  invitationExpiresAt: z.string(),
  accessExpiresAt: z.string(),
  maxAccesses: z.number(),
  accessCount: z.number(),
  claimedAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
  revocationReasonCode: z.string().nullable(),
  issuedAt: z.string(),
})
export type SageDeliveryGrantResponse = z.infer<typeof SageDeliveryGrantResponse>

export const SageDeliveryReceiptResponse = z.object({
  id: z.string(),
  eventType: z.string(),
  safeReasonCode: z.string().nullable(),
  occurredAt: z.string(),
})
export type SageDeliveryReceiptResponse = z.infer<typeof SageDeliveryReceiptResponse>
