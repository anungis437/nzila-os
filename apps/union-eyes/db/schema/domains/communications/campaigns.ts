/**
 * Communication Campaigns Schema
 * 
 * Phase 4: Communications & Organizing
 * Campaign management for email/SMS mass communication
 * 
 * Features:
 * - Multi-channel campaigns (email, SMS, push)
 * - Template system with variable substitution
 * - Audience segmentation
 * - Schedule and send controls
 * - Delivery tracking and analytics
 * - Consent compliance
 * 
 * Related Schemas:
 * - messages.ts (P2P messaging)
 * - newsletters.ts (content-focused campaigns)
 * - sms.ts (SMS delivery)
 * - analytics.ts (communication metrics)
 * 
 * Version: 1.0.0
 * Created: February 13, 2026
 */

import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  index,
} from 'drizzle-orm/pg-core';
import { organizations } from '../../../schema-organizations';

// ============================================================================
// ENUMS
// ============================================================================

export const campaignChannelEnum = pgEnum('campaign_channel', [
  'email',
  'sms',
  'push',
  'multi_channel',
]);

export const campaignTypeEnum = pgEnum('campaign_type', [
  'broadcast',      // One-time mass send
  'sequence',       // Multi-step automated sequence
  'triggered',      // Event-based (e.g., new member onboarding)
  'transactional',  // System notifications (dues reminders, etc.)
]);

export const campaignStatusEnum = pgEnum('campaign_status', [
  'draft',
  'scheduled',
  'sending',
  'sent',
  'paused',
  'cancelled',
  'failed',
]);

export const messageDeliveryStatusEnum = pgEnum('message_delivery_status', [
  'queued',
  'sent',
  'delivered',
  'bounced',
  'failed',
  'opened',
  'clicked',
  'unsubscribed',
  'complained',
]);

export const consentStatusEnum = pgEnum('consent_status', [
  'granted',
  'denied',
  'pending',
  'revoked',
  'expired',
]);

export const consentChannelEnum = pgEnum('consent_channel', [
  'email',
  'sms',
  'push',
  'phone',
  'mail',
]);

// ============================================================================
// MESSAGE TEMPLATES
// ============================================================================

/**
 * Message Templates
 * Reusable templates for campaigns with variable substitution
 */
export const messageTemplates = pgTable('message_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  
  // Template details
  type: campaignChannelEnum('type').notNull(), // email, sms, push
  category: varchar('category', { length: 100 }), // campaign, transactional, alert
  
  // Content
  subject: varchar('subject', { length: 500 }), // For email
  body: text('body').notNull(), // Template content with {{variables}}
  preheader: text('preheader'), // Email preview text
  
  // Variables
  variables: jsonb('variables').default([]), // [{name, description, required, default, example}]
  
  // Design
  htmlContent: text('html_content'), // Rich HTML for email
  plainTextContent: text('plain_text_content'), // Plain text fallback
  
  // Metadata
  metadata: jsonb('metadata').default({}),
  tags: text('tags').array(),
  
  // Status
  isActive: boolean('is_active').default(true),
  isDefault: boolean('is_default').default(false), // Default template for category
  
  // Audit
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  updatedBy: varchar('updated_by', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('idx_message_templates_org').on(table.organizationId),
  typeIdx: index('idx_message_templates_type').on(table.type),
  categoryIdx: index('idx_message_templates_category').on(table.category),
  isActiveIdx: index('idx_message_templates_active').on(table.isActive),
}));

// ============================================================================
// CAMPAIGNS
// ============================================================================

/**
 * Campaigns
 * Mass communication campaigns across channels
 */
export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Campaign details
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  
  // Type & channel
  type: campaignTypeEnum('type').notNull(), // broadcast, sequence, triggered
  channel: campaignChannelEnum('channel').notNull(), // email, sms, push
  
  // Template
  templateId: uuid('template_id')
    .references(() => messageTemplates.id, { onDelete: 'set null' }),
  
  // Audience
  segmentId: uuid('segment_id'), // Reference to saved member segment (future: member_segments table)
  segmentQuery: jsonb('segment_query'), // JSON query for dynamic segments
  audienceCount: integer('audience_count').default(0), // Cached count
  
  // Content (inline, overrides template)
  subject: varchar('subject', { length: 500 }),
  body: text('body'),
  variables: jsonb('variables').default({}), // Global variable values for campaign
  
  // Scheduling
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  sendImmediately: boolean('send_immediately').default(false),
  timezone: varchar('timezone', { length: 50 }).default('America/Toronto'),
  
  // Execution
  status: campaignStatusEnum('status').notNull().default('draft'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  
  // Statistics (updated async)
  stats: jsonb('stats').default({
    queued: 0,
    sent: 0,
    delivered: 0,
    bounced: 0,
    failed: 0,
    opened: 0,
    clicked: 0,
    unsubscribed: 0,
  }),
  
  // Configuration
  settings: jsonb('settings').default({
    trackOpens: true,
    trackClicks: true,
    respectQuietHours: true,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    maxRetriesOnFail: 3,
    batchSize: 100,
  }),
  
  // Metadata
  metadata: jsonb('metadata').default({}),
  tags: text('tags').array(),
  
  // Audit
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  updatedBy: varchar('updated_by', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('idx_campaigns_org').on(table.organizationId),
  statusIdx: index('idx_campaigns_status').on(table.status),
  channelIdx: index('idx_campaigns_channel').on(table.channel),
  typeIdx: index('idx_campaigns_type').on(table.type),
  scheduledAtIdx: index('idx_campaigns_scheduled').on(table.scheduledAt),
  createdAtIdx: index('idx_campaigns_created').on(table.createdAt),
}));

// ============================================================================
// MESSAGE LOG (IMMUTABLE)
// ============================================================================

/**
 * Message Log
 * Immutable delivery log for all sent messages
 * Used for compliance, auditing, and analytics
 */
export const messageLog = pgTable('message_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Campaign reference
  campaignId: uuid('campaign_id')
    .references(() => campaigns.id, { onDelete: 'set null' }),
  
  // Recipient
  recipientId: varchar('recipient_id', { length: 255 }).notNull(), // User/member ID
  recipientEmail: varchar('recipient_email', { length: 255 }),
  recipientPhone: varchar('recipient_phone', { length: 50 }),
  recipientName: varchar('recipient_name', { length: 255 }),
  
  // Message details
  channelType: campaignChannelEnum('channel_type').notNull(),
  provider: varchar('provider', { length: 50 }), // resend, twilio, firebase
  providerMessageId: varchar('provider_message_id', { length: 255 }), // External ID for tracking
  
  // Content (snapshot)
  subject: varchar('subject', { length: 500 }),
  bodySnippet: text('body_snippet'), // First 500 chars for reference
  
  // Delivery status
  status: messageDeliveryStatusEnum('status').notNull().default('queued'),
  errorMessage: text('error_message'),
  errorCode: varchar('error_code', { length: 50 }),
  retryCount: integer('retry_count').default(0),
  
  // Tracking
  sentAt: timestamp('sent_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  openedAt: timestamp('opened_at', { withTimezone: true }),
  clickedAt: timestamp('clicked_at', { withTimezone: true }),
  bouncedAt: timestamp('bounced_at', { withTimezone: true }),
  
  // Metadata
  metadata: jsonb('metadata').default({}),
  
  // Immutable timestamp (no updatedAt!)
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('idx_message_log_org').on(table.organizationId),
  campaignIdx: index('idx_message_log_campaign').on(table.campaignId),
  recipientIdx: index('idx_message_log_recipient').on(table.recipientId),
  statusIdx: index('idx_message_log_status').on(table.status),
  sentAtIdx: index('idx_message_log_sent').on(table.sentAt),
  createdAtIdx: index('idx_message_log_created').on(table.createdAt),
}));

// ============================================================================
// COMMUNICATION PREFERENCES
// ============================================================================

/**
 * Communication Preferences
 * User consent and preference management (CASL/GDPR compliance)
 */
export const communicationPreferences = pgTable('communication_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  
  userId: varchar('user_id', { length: 255 }).notNull(), // Unique per user per org
  
  // Channel preferences
  emailEnabled: boolean('email_enabled').default(true),
  smsEnabled: boolean('sms_enabled').default(false), // Opt-in by default (CASL)
  pushEnabled: boolean('push_enabled').default(true),
  phoneEnabled: boolean('phone_enabled').default(false),
  mailEnabled: boolean('mail_enabled').default(false),
  
  // Category preferences
  categories: jsonb('categories').default({
    campaign: true,         // Mass campaigns
    transactional: true,    // Dues reminders, receipts
    alerts: true,           // Urgent notices, strike votes
    newsletters: true,      // Content updates
    social: true,           // Event invitations
  }),
  
  // Frequency control
  frequency: varchar('frequency', { length: 50 }).default('real_time'), // real_time, daily_digest, weekly_digest
  quietHours: jsonb('quiet_hours').default({
    enabled: false,
    start: '22:00',
    end: '08:00',
    timezone: 'America/Toronto',
  }),
  
  // Unsubscribe tracking
  globallyUnsubscribed: boolean('globally_unsubscribed').default(false),
  unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
  unsubscribeReason: text('unsubscribe_reason'),
  
  // Metadata
  metadata: jsonb('metadata').default({}),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgUserIdx: index('idx_comm_prefs_org_user').on(table.organizationId, table.userId),
  emailEnabledIdx: index('idx_comm_prefs_email').on(table.emailEnabled),
  smsEnabledIdx: index('idx_comm_prefs_sms').on(table.smsEnabled),
  unsubscribedIdx: index('idx_comm_prefs_unsubscribed').on(table.globallyUnsubscribed),
}));

// ============================================================================
// CONSENT RECORDS (AUDIT TRAIL)
// ============================================================================

/**
 * Consent Records
 * Immutable audit log of all consent changes (CASL/GDPR requirement)
 */
export const consentRecords = pgTable('consent_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  
  userId: varchar('user_id', { length: 255 }).notNull(),
  
  // Consent details
  consentType: varchar('consent_type', { length: 100 }).notNull(), // email_marketing, sms_alerts, etc.
  channel: consentChannelEnum('channel').notNull(),
  status: consentStatusEnum('status').notNull(), // granted, denied, revoked
  
  // Context
  method: varchar('method', { length: 50 }), // web_form, api, admin_import, etc.
  consentText: text('consent_text'), // Exact text user consented to
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  
  // Expiration (for time-limited consent)
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  
  // Metadata
  metadata: jsonb('metadata').default({}),
  
  // Immutable timestamp
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('idx_consent_records_org').on(table.organizationId),
  userIdx: index('idx_consent_records_user').on(table.userId),
  channelIdx: index('idx_consent_records_channel').on(table.channel),
  statusIdx: index('idx_consent_records_status').on(table.status),
  createdAtIdx: index('idx_consent_records_created').on(table.createdAt),
}));

// ============================================================================
// COMMUNICATION CHANNELS (PROVIDER CONFIG)
// ============================================================================

/**
 * Communication Channels
 * Provider configuration for email/SMS services
 */
export const communicationChannels = pgTable('communication_channels', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  
  type: campaignChannelEnum('type').notNull(), // email, sms, push
  provider: varchar('provider', { length: 50 }).notNull(), // resend, sendgrid, twilio
  
  // Configuration (encrypted in production)
  config: jsonb('config').notNull(), // API keys, sender IDs, etc.
  
  // Status
  isActive: boolean('is_active').default(true),
  isPrimary: boolean('is_primary').default(false), // Primary provider for channel
  
  // Limits
  dailyLimit: integer('daily_limit'),
  monthlyLimit: integer('monthly_limit'),
  currentDailyCount: integer('current_daily_count').default(0),
  currentMonthlyCount: integer('current_monthly_count').default(0),
  
  // Health monitoring
  lastHealthCheck: timestamp('last_health_check', { withTimezone: true }),
  healthStatus: varchar('health_status', { length: 50 }).default('unknown'), // healthy, degraded, down
  
  // Metadata
  metadata: jsonb('metadata').default({}),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('idx_comm_channels_org').on(table.organizationId),
  typeIdx: index('idx_comm_channels_type').on(table.type),
  isActiveIdx: index('idx_comm_channels_active').on(table.isActive),
  isPrimaryIdx: index('idx_comm_channels_primary').on(table.isPrimary),
}));

// ============================================================================
// RELATIONS
// ============================================================================

export const messageTemplatesRelations = relations(messageTemplates, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [messageTemplates.organizationId],
    references: [organizations.id],
  }),
  campaigns: many(campaigns),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [campaigns.organizationId],
    references: [organizations.id],
  }),
  template: one(messageTemplates, {
    fields: [campaigns.templateId],
    references: [messageTemplates.id],
  }),
  messageLogs: many(messageLog),
}));

export const messageLogRelations = relations(messageLog, ({ one }) => ({
  organization: one(organizations, {
    fields: [messageLog.organizationId],
    references: [organizations.id],
  }),
  campaign: one(campaigns, {
    fields: [messageLog.campaignId],
    references: [campaigns.id],
  }),
}));

export const communicationPreferencesRelations = relations(communicationPreferences, ({ one }) => ({
  organization: one(organizations, {
    fields: [communicationPreferences.organizationId],
    references: [organizations.id],
  }),
}));

export const consentRecordsRelations = relations(consentRecords, ({ one }) => ({
  organization: one(organizations, {
    fields: [consentRecords.organizationId],
    references: [organizations.id],
  }),
}));

export const communicationChannelsRelations = relations(communicationChannels, ({ one }) => ({
  organization: one(organizations, {
    fields: [communicationChannels.organizationId],
    references: [organizations.id],
  }),
}));

// ============================================================================
// INFERRED TYPES
// ============================================================================

export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type InsertMessageTemplate = typeof messageTemplates.$inferInsert;

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;

export type MessageLog = typeof messageLog.$inferSelect;
export type InsertMessageLog = typeof messageLog.$inferInsert;

export type CommunicationPreferences = typeof communicationPreferences.$inferSelect;
export type InsertCommunicationPreferences = typeof communicationPreferences.$inferInsert;

export type ConsentRecord = typeof consentRecords.$inferSelect;
export type InsertConsentRecord = typeof consentRecords.$inferInsert;

export type CommunicationChannel = typeof communicationChannels.$inferSelect;
export type InsertCommunicationChannel = typeof communicationChannels.$inferInsert;
