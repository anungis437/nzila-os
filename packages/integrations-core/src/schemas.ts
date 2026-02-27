/**
 * Nzila OS — Integration Control Plane: Zod Schemas
 */
import { z } from 'zod'

// ── Enums ───────────────────────────────────────────────────────────────────

export const IntegrationTypeSchema = z.enum([
  'email', 'sms', 'push', 'chatops', 'crm', 'webhooks',
])

export const IntegrationProviderSchema = z.enum([
  'resend', 'sendgrid', 'mailgun', 'twilio', 'firebase',
  'slack', 'teams', 'hubspot',
])

export const IntegrationStatusSchema = z.enum(['active', 'inactive', 'suspended'])

export const DeliveryStatusSchema = z.enum(['queued', 'sent', 'failed', 'dlq'])

export const HealthStatusSchema = z.enum(['ok', 'degraded', 'down'])

// ── Config CRUD schemas ─────────────────────────────────────────────────────

export const CreateIntegrationConfigSchema = z.object({
  orgId: z.string().uuid(),
  type: IntegrationTypeSchema,
  provider: IntegrationProviderSchema,
  credentialsRef: z.string().min(1),
  metadata: z.record(z.unknown()).default({}),
})

export const UpdateIntegrationConfigSchema = z.object({
  status: IntegrationStatusSchema.optional(),
  credentialsRef: z.string().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
})

// ── Send message schema ─────────────────────────────────────────────────────

export const SendMessageSchema = z.object({
  orgId: z.string().uuid(),
  channel: IntegrationTypeSchema,
  to: z.string().min(1),
  templateId: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  variables: z.record(z.unknown()).optional(),
  correlationId: z.string().uuid(),
  metadata: z.record(z.unknown()).optional(),
})

// ── Webhook schemas ─────────────────────────────────────────────────────────

export const CreateWebhookSubscriptionSchema = z.object({
  orgId: z.string().uuid(),
  url: z.string().url(),
  events: z.array(z.string()).min(1),
  secret: z.string().min(16),
})

export type CreateIntegrationConfig = z.infer<typeof CreateIntegrationConfigSchema>
export type UpdateIntegrationConfig = z.infer<typeof UpdateIntegrationConfigSchema>
export type SendMessage = z.infer<typeof SendMessageSchema>
export type CreateWebhookSubscription = z.infer<typeof CreateWebhookSubscriptionSchema>
