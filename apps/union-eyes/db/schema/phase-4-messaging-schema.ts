/**
 * Phase 4 Messaging Schema
 * Message queue system for email and SMS campaigns
 */

import { pgTable, uuid, text, timestamp, integer, jsonb, pgEnum } from 'drizzle-orm/pg-core';

export const messageChannelEnum = pgEnum('message_channel', ['email', 'sms']);
export const messageStatusEnum = pgEnum('message_status', ['queued', 'sent', 'failed', 'skipped']);

/**
 * Message Log - Queue for outgoing messages
 */
export const message_log = pgTable('message_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id'),
  recipientId: text('recipient_id').notNull(),
  recipientEmail: text('recipient_email'),
  recipientPhone: text('recipient_phone'),
  channel: messageChannelEnum('channel').notNull(),
  subject: text('subject'),
  body: text('body').notNull(),
  variables: jsonb('variables'),
  status: messageStatusEnum('status').notNull().default('queued'),
  retryCount: integer('retry_count').default(0),
  scheduledAt: timestamp('scheduled_at').notNull().defaultNow(),
  sentAt: timestamp('sent_at'),
  externalId: text('external_id'),
  errorMessage: text('error_message'),
  nextRetryAt: timestamp('next_retry_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Campaigns - Message campaign tracking
 */
export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  organizationId: uuid('organization_id').notNull(),
  channel: messageChannelEnum('channel').notNull(),
  status: text('status').notNull().default('draft'),
  totalRecipients: integer('total_recipients').default(0),
  sentCount: integer('sent_count').default(0),
  failedCount: integer('failed_count').default(0),
  skippedCount: integer('skipped_count').default(0),
  scheduledAt: timestamp('scheduled_at'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  metadata: jsonb('metadata'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Communication Preferences - User opt-in/opt-out settings
 */
export const communicationPreferences = pgTable('communication_preferences_phase4', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  organizationId: uuid('organization_id').notNull(),
  emailOptIn: text('email_opt_in').default('true'),
  smsOptIn: text('sms_opt_in').default('true'),
  quietHoursStart: text('quiet_hours_start'),
  quietHoursEnd: text('quiet_hours_end'),
  timezone: text('timezone').default('America/Toronto'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type MessageLog = typeof message_log.$inferSelect;
export type NewMessageLog = typeof message_log.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
