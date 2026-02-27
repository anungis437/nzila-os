/**
 * Nzila OS — Integration Control Plane: Core Types
 *
 * Org-scoped integration configuration, health checks, and delivery tracking.
 */

// ── Integration taxonomy ────────────────────────────────────────────────────

export type IntegrationType =
  | 'email'
  | 'sms'
  | 'push'
  | 'chatops'
  | 'crm'
  | 'webhooks'

export type IntegrationProvider =
  | 'resend'
  | 'sendgrid'
  | 'mailgun'
  | 'twilio'
  | 'firebase'
  | 'slack'
  | 'teams'
  | 'hubspot'

export type IntegrationStatus = 'active' | 'inactive' | 'suspended'

export type DeliveryStatus =
  | 'queued'
  | 'sent'
  | 'failed'
  | 'dlq'

export type HealthStatus = 'ok' | 'degraded' | 'down'

// ── Org-scoped integration config ───────────────────────────────────────────

export interface IntegrationConfig {
  readonly id: string
  readonly orgId: string
  readonly type: IntegrationType
  readonly provider: IntegrationProvider
  /** Reference to credential in secrets vault — never raw keys */
  readonly credentialsRef: string
  readonly status: IntegrationStatus
  readonly metadata: Record<string, unknown>
  readonly createdBy: string
  readonly createdAt: string
  readonly updatedAt: string
}

// ── Health check ────────────────────────────────────────────────────────────

export interface HealthCheckResult {
  readonly provider: IntegrationProvider
  readonly status: HealthStatus
  readonly latencyMs: number
  readonly details: string | null
  readonly checkedAt: string
}

// ── Delivery tracking ───────────────────────────────────────────────────────

export interface IntegrationDelivery {
  readonly id: string
  readonly orgId: string
  readonly configId: string
  readonly channel: IntegrationType
  readonly provider: IntegrationProvider
  readonly recipientRef: string
  readonly templateId: string | null
  readonly status: DeliveryStatus
  readonly attempts: number
  readonly maxAttempts: number
  readonly lastError: string | null
  readonly providerMessageId: string | null
  readonly payload: Record<string, unknown>
  readonly correlationId: string
  readonly createdAt: string
  readonly updatedAt: string
}

// ── Dead Letter Queue entry ─────────────────────────────────────────────────

export interface DlqEntry {
  readonly id: string
  readonly deliveryId: string
  readonly orgId: string
  readonly provider: IntegrationProvider
  readonly channel: IntegrationType
  readonly lastError: string
  readonly payload: Record<string, unknown>
  readonly attempts: number
  readonly createdAt: string
  readonly replayedAt: string | null
}

// ── Adapter port ────────────────────────────────────────────────────────────

export interface SendRequest {
  readonly orgId: string
  readonly channel: IntegrationType
  readonly to: string
  readonly templateId?: string
  readonly subject?: string
  readonly body?: string
  readonly variables?: Record<string, unknown>
  readonly correlationId: string
  readonly metadata?: Record<string, unknown>
}

export interface SendResult {
  readonly ok: boolean
  readonly providerMessageId?: string
  readonly error?: string
}

export interface IntegrationAdapter {
  readonly provider: IntegrationProvider
  readonly channel: IntegrationType
  send(request: SendRequest, credentials: Record<string, unknown>): Promise<SendResult>
  healthCheck(credentials: Record<string, unknown>): Promise<HealthCheckResult>
}

// ── Webhook types ───────────────────────────────────────────────────────────

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

export interface WebhookDeliveryAttempt {
  readonly id: string
  readonly subscriptionId: string
  readonly event: string
  readonly payload: Record<string, unknown>
  readonly responseStatus: number | null
  readonly responseBody: string | null
  readonly success: boolean
  readonly attemptNumber: number
  readonly createdAt: string
}
