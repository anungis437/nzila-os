/**
 * Nzila OS — Webhooks: Types
 */
import { z } from 'zod'

// ── Subscription ────────────────────────────────────────────────────────────

export interface WebhookSubscription {
  readonly id: string
  readonly orgId: string
  readonly url: string
  readonly events: readonly string[]
  readonly secret: string
  readonly active: boolean
  readonly createdBy: string
  readonly createdAt: string
  readonly updatedAt: string
}

// ── Delivery attempt ────────────────────────────────────────────────────────

export interface WebhookDeliveryAttempt {
  readonly id: string
  readonly subscriptionId: string
  readonly event: string
  readonly payload: Record<string, unknown>
  readonly idempotencyKey: string
  readonly responseStatus: number | null
  readonly responseBody: string | null
  readonly success: boolean
  readonly attemptNumber: number
  readonly createdAt: string
}

// ── Inbound webhook ─────────────────────────────────────────────────────────

export interface InboundWebhookPayload {
  readonly headers: Record<string, string>
  readonly body: string
  readonly signature: string
}

export interface InboundWebhookResult {
  readonly verified: boolean
  readonly parsed: Record<string, unknown> | null
  readonly error?: string
}

// ── Schemas ─────────────────────────────────────────────────────────────────

export const CreateWebhookSubscriptionSchema = z.object({
  orgId: z.string().uuid(),
  url: z.string().url(),
  events: z.array(z.string().min(1)).min(1),
  secret: z.string().min(16),
  createdBy: z.string().min(1),
})

export const WebhookEventPayloadSchema = z.object({
  event: z.string().min(1),
  payload: z.record(z.unknown()),
  idempotencyKey: z.string().uuid(),
  timestamp: z.string().datetime(),
})

export type CreateWebhookSubscriptionInput = z.infer<typeof CreateWebhookSubscriptionSchema>
export type WebhookEventPayload = z.infer<typeof WebhookEventPayloadSchema>
