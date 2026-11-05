/**
 * @nzila/platform-integrations-control-plane — Types
 *
 * Control plane types for managing integrations at the platform level.
 * Builds on top of @nzila/integrations-core and @nzila/integrations-runtime.
 *
 * @module @nzila/platform-integrations-control-plane/types
 */
import { z } from 'zod'

// ── Provider Health ─────────────────────────────────────────────────────────

export type ProviderStatus = 'healthy' | 'degraded' | 'down' | 'unknown'

export interface ProviderHealth {
  readonly provider: string
  readonly status: ProviderStatus
  readonly circuitState: 'closed' | 'open' | 'half-open'
  readonly successRate: number
  readonly avgLatencyMs: number
  readonly lastCheckedAt: string
  readonly consecutiveFailures: number
  readonly totalDeliveries: number
  readonly totalFailures: number
}

// ── DLQ Entry ───────────────────────────────────────────────────────────────

export interface DlqEntry {
  readonly id: string
  readonly orgId: string
  readonly provider: string
  readonly channel: string
  readonly payload: Record<string, unknown>
  readonly error: string
  readonly attempts: number
  readonly failedAt: string
  readonly correlationId: string
}

export interface DlqReplayResult {
  readonly entryId: string
  readonly status: 'replayed' | 'failed'
  readonly error?: string
}

// ── Webhook Verification ────────────────────────────────────────────────────

export interface WebhookVerificationResult {
  readonly valid: boolean
  readonly provider: string
  readonly reason?: string
  readonly verifiedAt: string
}

// ── Rate Limit ──────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  readonly orgId: string
  readonly provider: string
  readonly maxRequestsPerMinute: number
  readonly maxRequestsPerHour: number
  readonly burstLimit: number
}

export interface RateLimitStatus {
  readonly orgId: string
  readonly provider: string
  readonly currentMinuteCount: number
  readonly currentHourCount: number
  readonly isThrottled: boolean
  readonly resetAt: string
}

// ── Dashboard ───────────────────────────────────────────────────────────────

export interface IntegrationDashboardSummary {
  readonly totalProviders: number
  readonly healthyProviders: number
  readonly degradedProviders: number
  readonly downProviders: number
  readonly dlqDepth: number
  readonly totalDeliveries24h: number
  readonly successRate24h: number
  readonly avgLatencyMs24h: number
  readonly providers: readonly ProviderHealth[]
}

// ── Zod Schemas ─────────────────────────────────────────────────────────────

export const webhookPayloadSchema = z.object({
  body: z.string(),
  signature: z.string(),
  provider: z.string().min(1),
  timestamp: z.string().optional(),
})

export const dlqReplayRequestSchema = z.object({
  entryIds: z.array(z.guid()).min(1).max(100),
})

export const rateLimitConfigSchema = z.object({
  orgId: z.guid(),
  provider: z.string().min(1),
  maxRequestsPerMinute: z.number().int().positive().max(10_000),
  maxRequestsPerHour: z.number().int().positive().max(100_000),
  burstLimit: z.number().int().positive().max(1_000),
})

export type WebhookPayload = z.infer<typeof webhookPayloadSchema>
export type DlqReplayRequest = z.infer<typeof dlqReplayRequestSchema>
