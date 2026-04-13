/**
 * @nzila/platform-integrations-types — Delivery Types
 *
 * Canonical types for webhook delivery, dead letters, and retry.
 */

// ─── Delivery Attempt ────────────────────────────────────────────────────────

export type DeliveryAttemptStatus =
  | 'pending'
  | 'success'
  | 'failed'
  | 'timeout'
  | 'rejected'

export interface DeliveryAttempt {
  readonly id: string
  readonly runId: string
  readonly attemptNumber: number
  readonly status: DeliveryAttemptStatus
  readonly responseCode: number | null
  readonly responseExcerpt: string | null
  readonly durationMs: number | null
  readonly attemptedAt: string
  readonly error: string | null
}

// ─── Dead Letter Record ──────────────────────────────────────────────────────

export interface DeadLetterRecord {
  readonly id: string
  readonly orgId: string
  readonly connectionId: string
  readonly eventType: string
  readonly payloadJson: Record<string, unknown>
  readonly reason: string
  readonly traceId: string | null
  readonly maxAttemptsReached: boolean
  readonly createdAt: string
  readonly resolvedAt: string | null
  readonly resolvedBy: string | null
  readonly resolutionNotes: string | null
}

export interface CreateDeadLetterInput {
  readonly orgId: string
  readonly connectionId: string
  readonly eventType: string
  readonly payloadJson: Record<string, unknown>
  readonly reason: string
  readonly traceId?: string
  readonly maxAttemptsReached?: boolean
}

// ─── Webhook Delivery Config ─────────────────────────────────────────────────

export interface WebhookDeliveryConfig {
  readonly url: string
  readonly method: 'POST' | 'PUT' | 'PATCH'
  readonly headers: Record<string, string>
  readonly signatureHeader?: string
  readonly signatureAlgorithm?: 'hmac-sha256' | 'hmac-sha512'
  readonly signingSecret?: string
  readonly timeout: number // ms
  readonly retryPolicy: RetryPolicy
}

export interface RetryPolicy {
  readonly maxAttempts: number
  readonly initialDelayMs: number
  readonly maxDelayMs: number
  readonly backoffMultiplier: number
  readonly retryableStatusCodes: readonly number[]
}

// ─── Replay Request ──────────────────────────────────────────────────────────

export interface ReplayRequest {
  readonly deadLetterIds: readonly string[]
  readonly actorId: string
  readonly reason: string
}

export interface ReplayResult {
  readonly deadLetterId: string
  readonly success: boolean
  readonly newRunId: string | null
  readonly error: string | null
}
