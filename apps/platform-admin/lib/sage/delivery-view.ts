/**
 * Platform Admin — SAGE Phase 8A delivery view mappers (browser-safe)
 *
 * Projects sage-core delivery domain objects to the exact response shapes. Never
 * exposes token hashes, session hashes, recipient email, storage references, or
 * internal identity subjects to the browser.
 */
import type {
  SageDeliveryGrant,
  SageDeliveryReceipt,
  SageDeliveryRecipient,
  SageDeliveryRequest,
} from '@nzila/sage-core'
import type {
  SageDeliveryGrantResponse,
  SageDeliveryReceiptResponse,
  SageDeliveryRecipientResponse,
  SageDeliveryRequestResponse,
} from './delivery-schemas'

export function toDeliveryRecipientResponse(
  r: SageDeliveryRecipient,
): SageDeliveryRecipientResponse {
  return {
    id: r.id,
    displayName: r.displayName,
    identityProvider: r.identityProvider,
    verificationStatus: r.verificationStatus,
    verifiedAt: r.verifiedAt ?? null,
    createdAt: r.createdAt,
  }
}

export function toDeliveryRequestResponse(r: SageDeliveryRequest): SageDeliveryRequestResponse {
  return {
    id: r.id,
    exportPackageId: r.exportPackageId,
    recipientId: r.recipientId,
    status: r.status,
    purpose: r.purpose ?? null,
    packageContentHash: r.packageContentHash,
    requestedAccessExpiresAt: r.requestedAccessExpiresAt,
    requestedMaxAccesses: r.requestedMaxAccesses,
    requestedAt: r.requestedAt,
  }
}

export function toDeliveryGrantResponse(g: SageDeliveryGrant): SageDeliveryGrantResponse {
  return {
    id: g.id,
    deliveryRequestId: g.deliveryRequestId,
    exportPackageId: g.exportPackageId,
    recipientId: g.recipientId,
    status: g.status,
    invitationExpiresAt: g.invitationExpiresAt,
    accessExpiresAt: g.accessExpiresAt,
    maxAccesses: g.maxAccesses,
    accessCount: g.accessCount,
    claimedAt: g.claimedAt ?? null,
    revokedAt: g.revokedAt ?? null,
    revocationReasonCode: g.revocationReasonCode ?? null,
    issuedAt: g.issuedAt,
  }
}

export function toDeliveryReceiptResponse(r: SageDeliveryReceipt): SageDeliveryReceiptResponse {
  return {
    id: r.id,
    eventType: r.eventType,
    safeReasonCode: r.safeReasonCode ?? null,
    occurredAt: r.occurredAt,
  }
}
