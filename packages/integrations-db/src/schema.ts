/**
 * Nzila OS — Integration DB schema (Drizzle ORM)
 *
 * Org-scoped tables for integration configs, deliveries, and DLQ.
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  pgEnum,
  integer,
  varchar,
  boolean,
} from 'drizzle-orm/pg-core'

// ── Enums ───────────────────────────────────────────────────────────────────

export const integrationTypeEnum = pgEnum('integration_type', [
  'email', 'sms', 'push', 'chatops', 'crm', 'webhooks',
])

export const integrationProviderEnum = pgEnum('integration_provider', [
  'resend', 'sendgrid', 'mailgun', 'twilio', 'firebase',
  'slack', 'teams', 'hubspot',
])

export const integrationStatusEnum = pgEnum('integration_status', [
  'active', 'inactive', 'suspended',
])

export const deliveryStatusEnum = pgEnum('delivery_status', [
  'queued', 'sent', 'failed', 'dlq',
])

// ── integration_configs ─────────────────────────────────────────────────────

export const integrationConfigs = pgTable('integration_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  type: integrationTypeEnum('type').notNull(),
  provider: integrationProviderEnum('provider').notNull(),
  /** Reference to credential in secrets vault — never raw keys */
  credentialsRef: text('credentials_ref').notNull(),
  status: integrationStatusEnum('status').notNull().default('inactive'),
  metadata: jsonb('metadata').notNull().default({}),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── integration_deliveries ──────────────────────────────────────────────────

export const integrationDeliveries = pgTable('integration_deliveries', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  configId: uuid('config_id')
    .notNull()
    .references(() => integrationConfigs.id),
  channel: integrationTypeEnum('channel').notNull(),
  provider: integrationProviderEnum('provider').notNull(),
  recipientRef: text('recipient_ref').notNull(),
  templateId: text('template_id'),
  status: deliveryStatusEnum('status').notNull().default('queued'),
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(3),
  lastError: text('last_error'),
  providerMessageId: text('provider_message_id'),
  payload: jsonb('payload').notNull().default({}),
  correlationId: uuid('correlation_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── integration_dlq (dead-letter queue) ─────────────────────────────────────

export const integrationDlq = pgTable('integration_dlq', {
  id: uuid('id').primaryKey().defaultRandom(),
  deliveryId: uuid('delivery_id')
    .notNull()
    .references(() => integrationDeliveries.id),
  orgId: uuid('org_id').notNull(),
  provider: integrationProviderEnum('provider').notNull(),
  channel: integrationTypeEnum('channel').notNull(),
  lastError: text('last_error').notNull(),
  payload: jsonb('payload').notNull().default({}),
  attempts: integer('attempts').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  replayedAt: timestamp('replayed_at', { withTimezone: true }),
})

// ── webhook_subscriptions ───────────────────────────────────────────────────

export const webhookSubscriptions = pgTable('webhook_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  url: text('url').notNull(),
  events: jsonb('events').notNull().default([]),
  secret: text('secret').notNull(),
  active: boolean('active').notNull().default(true),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── webhook_delivery_attempts ───────────────────────────────────────────────

export const webhookDeliveryAttempts = pgTable('webhook_delivery_attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  subscriptionId: uuid('subscription_id')
    .notNull()
    .references(() => webhookSubscriptions.id),
  event: varchar('event', { length: 128 }).notNull(),
  payload: jsonb('payload').notNull().default({}),
  responseStatus: integer('response_status'),
  responseBody: text('response_body'),
  success: boolean('success').notNull().default(false),
  attemptNumber: integer('attempt_number').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
