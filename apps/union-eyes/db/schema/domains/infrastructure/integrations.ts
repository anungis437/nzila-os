/**
 * Integration Framework Database Schema
 * Drizzle ORM schema definitions for integration tables
 */

import { pgTable, uuid, text, jsonb, boolean, timestamp, integer, pgEnum, varchar, index } from 'drizzle-orm/pg-core';
import { organizations } from '../../../schema-organizations';

// Enums
export const integrationTypeEnum = pgEnum('integration_type', [
  'hris',
  'accounting',
  'insurance',
  'pension',
  'lms',
  'communication',
  'document_management',
  'calendar',
  'social_media',
  'payment',
]);

export const integrationProviderEnum = pgEnum('integration_provider', [
  // HRIS
  'workday',
  'bamboohr',
  'adp',
  'ceridian_dayforce',
  'ukg_pro',
  // Accounting
  'quickbooks',
  'xero',
  'sage_intacct',
  'freshbooks',
  'wave',
  // Insurance
  'sunlife',
  'manulife',
  'blue_cross',
  'green_shield',
  'canada_life',
  // Pension
  'otpp',
  'cpp_qpp',
  'provincial_pension',
  // LMS
  'linkedin_learning',
  'udemy',
  'coursera',
  // Communication
  'slack',
  'microsoft_teams',
  // Document Management
  'sharepoint',
  'google_drive',
  'dropbox',
  // Custom
  'custom',
]);

export const syncTypeEnum = pgEnum('sync_type', ['full', 'incremental', 'real_time']);

export const syncStatusEnum = pgEnum('sync_status', [
  'idle',
  'pending',
  'running',
  'success',
  'failed',
  'partial',
  'cancelled',
]);

export const webhookStatusEnum = pgEnum('webhook_status', [
  'received',
  'processing',
  'processed',
  'failed',
  'ignored',
]);

// Tables
export const integrationConfigs = pgTable('integration_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  type: integrationTypeEnum('type').notNull(),
  provider: integrationProviderEnum('provider').notNull(),
  credentials: jsonb('credentials').notNull(), // Encrypted
  settings: jsonb('settings'),
  webhookUrl: text('webhook_url'),
  enabled: boolean('enabled').default(true),
  lastSyncAt: timestamp('last_sync_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const integrationSyncLog = pgTable('integration_sync_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  provider: integrationProviderEnum('provider').notNull(),
  syncType: syncTypeEnum('sync_type').notNull(),
  orgs: text('orgs').array(),
  status: syncStatusEnum('status').notNull(),
  recordsProcessed: integer('records_processed').default(0),
  recordsCreated: integer('records_created').default(0),
  recordsUpdated: integer('records_updated').default(0),
  recordsFailed: integer('records_failed').default(0),
  cursor: text('cursor'),
  error: text('error'),
  startedAt: timestamp('started_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});

export const webhookEvents = pgTable('webhook_events', {
  id: text('id').primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  provider: integrationProviderEnum('provider').notNull(),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload').notNull(),
  signature: text('signature'),
  verified: boolean('verified').default(false),
  status: webhookStatusEnum('status').notNull().default('received'),
  error: text('error'),
  receivedAt: timestamp('received_at').defaultNow(),
  processedAt: timestamp('processed_at'),
});

export const integrationSyncSchedules = pgTable('integration_sync_schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  provider: integrationProviderEnum('provider').notNull(),
  syncType: syncTypeEnum('sync_type').notNull(),
  orgs: text('orgs').array(),
  schedule: text('schedule').notNull(), // Cron expression
  enabled: boolean('enabled').default(true),
  lastRunAt: timestamp('last_run_at'),
  nextRunAt: timestamp('next_run_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

/**
 * API Keys - for programmatic access to UnionEyes APIs
 */
export const integrationApiKeys = pgTable(
  'integration_api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    keyHash: varchar('key_hash', { length: 64 }).notNull(), // SHA-256 hash
    keyPrefix: varchar('key_prefix', { length: 10 }).notNull(), // For identification
    scopes: text('scopes').array().notNull(),
    isActive: boolean('is_active').default(true),
    expiresAt: timestamp('expires_at'),
    lastUsedAt: timestamp('last_used_at'),
    usageCount: integer('usage_count').default(0),
    createdBy: varchar('created_by', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    revokedAt: timestamp('revoked_at'),
    revokedBy: varchar('revoked_by', { length: 255 }),
  },
  (table) => ({
    orgIdx: index('integration_api_keys_org_idx').on(table.organizationId),
    keyHashIdx: index('integration_api_keys_hash_idx').on(table.keyHash),
    activeIdx: index('integration_api_keys_active_idx').on(table.isActive),
  })
);

/**
 * Webhooks - for receiving real-time event notifications
 */
export const integrationWebhooks = pgTable(
  'integration_webhooks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    description: text('description'),
    events: text('events').array().notNull(),
    secret: varchar('secret', { length: 255 }).notNull(),
    isActive: boolean('is_active').default(true),
    deliveryCount: integer('delivery_count').default(0),
    failureCount: integer('failure_count').default(0),
    lastTriggeredAt: timestamp('last_triggered_at'),
    lastSuccessAt: timestamp('last_success_at'),
    lastFailureAt: timestamp('last_failure_at'),
    createdBy: varchar('created_by', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    orgIdx: index('integration_webhooks_org_idx').on(table.organizationId),
    activeIdx: index('integration_webhooks_active_idx').on(table.isActive),
  })
);

/**
 * Webhook Delivery Log - audit trail of webhook deliveries
 */
export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    webhookId: uuid('webhook_id').notNull().references(() => integrationWebhooks.id, { onDelete: 'cascade' }),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    payload: jsonb('payload').notNull(),
    statusCode: integer('status_code'),
    responseBody: text('response_body'),
    error: text('error'),
    attemptNumber: integer('attempt_number').default(1),
    deliveredAt: timestamp('delivered_at').defaultNow(),
    duration: integer('duration'), // milliseconds
  },
  (table) => ({
    webhookIdx: index('webhook_deliveries_webhook_idx').on(table.webhookId),
    deliveredAtIdx: index('webhook_deliveries_delivered_at_idx').on(table.deliveredAt),
  })
);

// Type exports
export type IntegrationConfig = typeof integrationConfigs.$inferSelect;
export type NewIntegrationConfig = typeof integrationConfigs.$inferInsert;
export type IntegrationSyncLog = typeof integrationSyncLog.$inferSelect;
export type NewIntegrationSyncLog = typeof integrationSyncLog.$inferInsert;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;
export type IntegrationSyncSchedule = typeof integrationSyncSchedules.$inferSelect;
export type NewIntegrationSyncSchedule = typeof integrationSyncSchedules.$inferInsert;
export type IntegrationApiKey = typeof integrationApiKeys.$inferSelect;
export type NewIntegrationApiKey = typeof integrationApiKeys.$inferInsert;
export type IntegrationWebhook = typeof integrationWebhooks.$inferSelect;
export type NewIntegrationWebhook = typeof integrationWebhooks.$inferInsert;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;

// ============================================================================
// INTEGRATION PARTNERS (console dashboard)
// ============================================================================

export const integrationPartners = pgTable('integration_partners', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict' }),
  name: varchar('name', { length: 255 }).notNull(),
  provider: varchar('provider', { length: 100 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('connected'),
  description: text('description'),
  icon: varchar('icon', { length: 500 }),
  config: jsonb('config').$type<Record<string, unknown>>().default({}),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type IntegrationPartner = typeof integrationPartners.$inferSelect;
export type NewIntegrationPartner = typeof integrationPartners.$inferInsert;
