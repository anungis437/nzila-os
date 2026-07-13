// ─── @nzila/sage-core — Phase 8A delivery notification port ──────────────────
// sage-core does not send email. It defines the PORT the platform runtime
// implements over its existing notification provider. The invitation token
// flows to the notifier ONLY to build the secure claim URL — it is never
// logged, audited, or persisted in plaintext.

/**
 * A recipient-safe invitation message. Contains NO package bytes, evidence
 * content, decision narrative, storage reference, token hash, or
 * workspace-internal detail.
 */
export interface SageDeliveryInvitationMessage {
  /** SAGE grant this invitation belongs to (for provider idempotency/routing). */
  grantId: string
  recipientId: string
  /** Deterministic hash of the recipient's verified email (address resolution is the adapter's job). */
  recipientEmailHash: string
  /** Recipient-safe issuing organization name. */
  organizationSafeName: string
  /** Recipient-safe purpose summary (may be null). */
  purposeSummary?: string | null
  /** ISO instant the invitation expires. */
  invitationExpiresAt: string
  /** One-time claim token plaintext — used only to build the secure claim URL. */
  claimToken: string
  /** Recipient-safe support contact (may be null). */
  supportContact?: string | null
  /** Stable message id (== grant-scoped) for at-least-once + dedupe. */
  messageId: string
  /** Provider idempotency key where supported. */
  idempotencyKey: string
}

export interface SageDeliveryNotifyResult {
  /** Whether the provider ACCEPTED the message (not proof of delivery). */
  accepted: boolean
  /** Provider-assigned message identifier, when available. Never a token. */
  providerMessageId?: string | null
}

/**
 * Port implemented by the platform runtime. Delivery is AT-LEAST-ONCE with a
 * stable messageId; implementations must NOT claim exactly-once email delivery,
 * and MUST fail closed in production rather than printing the token.
 */
export interface SageDeliveryNotifier {
  sendInvitation(message: SageDeliveryInvitationMessage): Promise<SageDeliveryNotifyResult>
}

/**
 * Port for rate-limiting recipient claim/access attempts. Implemented by the
 * platform runtime over its existing limiter. Keys are safe combinations
 * (token-hash prefix, recipient subject, IP-derived limiter key) — NEVER raw
 * IPs stored in SAGE audit.
 */
export interface SageDeliveryRateLimiter {
  check(key: string): Promise<{ allowed: boolean; retryAfterSeconds?: number }>
}
