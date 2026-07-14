// ─── @nzila/sage-core — Phase 8A delivery domain types ───────────────────────
// Secure external delivery of an immutable export package to ONE verified
// recipient, under an independently-approved, revocable, expiring, grant-scoped
// access. Never workspace membership; never an anonymous public link.

// ── Recipient verification ───────────────────────────────────────────────────
export const SAGE_DELIVERY_RECIPIENT_VERIFICATION_STATUSES = [
  'unverified',
  'verified',
  'revoked',
] as const
export type SageDeliveryRecipientVerificationStatus =
  (typeof SAGE_DELIVERY_RECIPIENT_VERIFICATION_STATUSES)[number]

export type SageDeliveryRecipient = {
  id: string
  orgId: string
  workspaceId: string
  displayName: string
  identityProvider: string
  identitySubject: string
  normalizedEmailHash: string
  verificationStatus: SageDeliveryRecipientVerificationStatus
  verifiedAt?: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
}

// ── Delivery request ─────────────────────────────────────────────────────────
export const SAGE_DELIVERY_REQUEST_STATUSES = [
  'requested',
  'approved',
  'denied',
  'issued',
  'revoked',
  'expired',
] as const
export type SageDeliveryRequestStatus = (typeof SAGE_DELIVERY_REQUEST_STATUSES)[number]

export type SageDeliveryRequest = {
  id: string
  orgId: string
  workspaceId: string
  exportPackageId: string
  recipientId: string
  requestedBy: string
  purpose?: string | null
  status: SageDeliveryRequestStatus
  packageContentHash: string
  packageManifestHash: string
  recipientIdentityHash: string
  policyVersion: string
  requestedAccessExpiresAt: string
  requestedMaxAccesses: number
  requestedAt: string
  updatedAt: string
}

// ── Delivery approval (frozen decision) ──────────────────────────────────────
export const SAGE_DELIVERY_DECISIONS = ['approved', 'denied'] as const
export type SageDeliveryDecision = (typeof SAGE_DELIVERY_DECISIONS)[number]

export type SageDeliveryApproval = {
  id: string
  orgId: string
  workspaceId: string
  deliveryRequestId: string
  decision: SageDeliveryDecision
  approverId: string
  rationale?: string | null
  approvedPackageContentHash: string
  approvedManifestHash: string
  approvedRecipientIdentityHash: string
  approvedPolicyVersion: string
  approvedAccessExpiresAt: string
  approvedMaxAccesses: number
  decidedAt: string
}

// ── Invitation + grant-scoped access ─────────────────────────────────────────
export const SAGE_DELIVERY_GRANT_STATUSES = ['issued', 'active', 'revoked', 'expired'] as const
export type SageDeliveryGrantStatus = (typeof SAGE_DELIVERY_GRANT_STATUSES)[number]

export const SAGE_DELIVERY_REVOCATION_REASON_CODES = [
  'recipient_request',
  'policy_change',
  'security_concern',
  'sent_in_error',
  'no_longer_required',
  'other',
] as const
export type SageDeliveryRevocationReasonCode =
  (typeof SAGE_DELIVERY_REVOCATION_REASON_CODES)[number]

export type SageDeliveryGrant = {
  id: string
  orgId: string
  workspaceId: string
  deliveryRequestId: string
  exportPackageId: string
  recipientId: string
  status: SageDeliveryGrantStatus
  invitationTokenHash: string
  invitationExpiresAt: string
  sessionTokenHash?: string | null
  claimedIdentityProvider?: string | null
  claimedIdentitySubject?: string | null
  claimedAt?: string | null
  accessExpiresAt: string
  maxAccesses: number
  accessCount: number
  issuedBy: string
  issuedAt: string
  revokedBy?: string | null
  revokedAt?: string | null
  revocationReasonCode?: SageDeliveryRevocationReasonCode | null
  updatedAt: string
}

// ── Durable delivery receipts ────────────────────────────────────────────────
export const SAGE_DELIVERY_RECEIPT_EVENT_TYPES = [
  'invitation_issued',
  'invitation_claimed',
  'access_authorized',
  'access_denied',
  'download_authorized',
  'recipient_acknowledged',
  'grant_revoked',
  'grant_expired',
] as const
export type SageDeliveryReceiptEventType = (typeof SAGE_DELIVERY_RECEIPT_EVENT_TYPES)[number]

export type SageDeliveryReceipt = {
  id: string
  eventId: string
  orgId: string
  workspaceId: string
  deliveryRequestId?: string | null
  grantId?: string | null
  packageId?: string | null
  recipientId?: string | null
  eventType: SageDeliveryReceiptEventType
  safeReasonCode?: string | null
  occurredAt: string
  createdAt: string
}

/**
 * Intent to append a durable delivery receipt inside a domain transaction.
 * `safeReasonCode` is a bounded code — never narrative, email, token, IP, or
 * user-agent.
 */
export type SageDeliveryReceiptIntent = {
  eventId: string
  deliveryRequestId?: string | null
  grantId?: string | null
  packageId?: string | null
  recipientId?: string | null
  eventType: SageDeliveryReceiptEventType
  safeReasonCode?: string | null
  occurredAt: string
}

// ── Notification Outbox (Phase 8A.1) ──────────────────────────────────────────
// Durable notification queue for invitation issuance. Enables crash-safe delivery:
// the plaintext token is held encrypted in this table and can be recovered after
// a process crash, allowing the recipient to be notified with the same invitation.
export const SAGE_NOTIFICATION_STATUSES = ['pending', 'dispatching', 'dispatched', 'failed'] as const
export type SageNotificationStatus = (typeof SAGE_NOTIFICATION_STATUSES)[number]

export type SageNotificationOutbox = {
  id: string
  messageId: string
  orgId: string
  workspaceId: string
  deliveryRequestId: string
  grantId: string
  recipientId: string
  provider: string
  template: string
  recipientAddressHash: string
  encryptedPayload: string // enc:v1:... format; never plaintext
  encryptionKeyReference: string
  status: SageNotificationStatus
  dispatchOwner?: string | null
  leaseExpiresAt?: string | null
  attemptCount: number
  maxRetries: number
  providerMessageId?: string | null
  providerRequestId?: string | null
  lastErrorCode?: string | null
  lastErrorMessage?: string | null
  createdAt: string
  dispatchedAt?: string | null
  payloadDestroyedAt?: string | null
}

/**
 * Intent to enqueue a notification message in the durable outbox.
 * Called within the same transaction as the grant creation.
 */
export type SageNotificationOutboxIntent = {
  messageId: string
  deliveryRequestId: string
  grantId: string
  recipientId: string
  provider: string
  template: string
  recipientAddressHash: string
  encryptedPayload: string
  encryptionKeyReference?: string
  createdAt: string
}
