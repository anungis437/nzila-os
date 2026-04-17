/**
 * Nzila OS — Platform Integrations schema
 *
 * Org-scoped provider connection records used by Console integration APIs.
 * Secrets are stored encrypted at rest in `secrets_encrypted`.
 */
import {
  pgEnum,
  pgTable,
  text,
  integer,
  index,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  jsonb,
  boolean,
} from 'drizzle-orm/pg-core'
import { orgs } from './orgs'

export const platformIntegrationProviderEnum = pgEnum('platform_integration_provider', [
  'resend',
  'sendgrid',
  'mailgun',
  'twilio',
  'firebase',
  'slack',
  'teams',
  'hubspot',
  'm365',
  'google-workspace',
  'webhooks',
])

export const platformIntegrationConnectionStatusEnum = pgEnum('platform_integration_connection_status', [
  'connected',
  'degraded',
  'error',
  'disconnected',
])

export const platformIntegrationDeliveryStatusEnum = pgEnum('platform_integration_delivery_status', [
  'queued',
  'sent',
  'failed',
  'dlq',
])

export const platformIntegrationConnections = pgTable(
  'platform_integration_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    provider: platformIntegrationProviderEnum('provider').notNull(),
    status: platformIntegrationConnectionStatusEnum('status').notNull().default('disconnected'),
    secretsEncrypted: text('secrets_encrypted').notNull(),
    secretsFingerprint: varchar('secrets_fingerprint', { length: 128 }).notNull(),
    lastValidatedAt: timestamp('last_validated_at', { withTimezone: true }),
    lastValidationOk: boolean('last_validation_ok').notNull().default(false),
    lastValidationError: text('last_validation_error'),
    metadata: jsonb('metadata').notNull().default({}),
    createdBy: text('created_by').notNull(),
    updatedBy: text('updated_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('platform_integration_connections_org_provider_uq').on(table.orgId, table.provider),
  ],
)

export const platformIntegrationDeliveries = pgTable(
  'platform_integration_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    provider: platformIntegrationProviderEnum('provider').notNull(),
    channel: varchar('channel', { length: 32 }).notNull(),
    recipient: text('recipient').notNull(),
    status: platformIntegrationDeliveryStatusEnum('status').notNull().default('queued'),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(3),
    payloadJson: jsonb('payload_json').notNull().default({}),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('platform_integration_deliveries_org_provider_created_idx').on(
      table.orgId,
      table.provider,
      table.createdAt,
    ),
  ],
)

export const platformIntegrationDlqEntries = pgTable(
  'platform_integration_dlq_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    deliveryId: uuid('delivery_id').references(() => platformIntegrationDeliveries.id),
    provider: platformIntegrationProviderEnum('provider').notNull(),
    eventType: varchar('event_type', { length: 128 }).notNull(),
    retryCount: integer('retry_count').notNull().default(0),
    lastError: text('last_error').notNull(),
    payloadJson: jsonb('payload_json').notNull().default({}),
    failedAt: timestamp('failed_at', { withTimezone: true }).notNull().defaultNow(),
    replayedAt: timestamp('replayed_at', { withTimezone: true }),
    replayedBy: text('replayed_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('platform_integration_dlq_entries_org_provider_failed_idx').on(
      table.orgId,
      table.provider,
      table.failedAt,
    ),
  ],
)