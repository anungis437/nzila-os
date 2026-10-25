/**
 * SMS Communication System Schema (Phase 5 - Week 1)
 * Complete Twilio SMS integration with templates, campaigns, and two-way messaging
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  decimal,
  jsonb,
  unique,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { organizations } from '../schema-organizations';
import { profiles } from './profiles-schema';

// ============================================================================
// SMS TEMPLATES
// ============================================================================

export const smsTemplates = pgTable(
  'sms_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    messageTemplate: text('message_template').notNull(),
    variables: text('variables').array().default([]),
    category: text('category'),
    isActive: boolean('is_active').default(true),
    createdBy: text('created_by').references(() => profiles.userId, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    organizationNameUnique: unique().on(table.organizationId, table.name),
    messageLengthCheck: check('sms_template_message_length', sql`char_length(message_template) <= 1600`),
  })
);

export type SmsTemplate = typeof smsTemplates.$inferSelect;
export type NewSmsTemplate = typeof smsTemplates.$inferInsert;

// ============================================================================
// SMS CAMPAIGNS
// ============================================================================

export const smsCampaigns = pgTable('sms_campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  message: text('message').notNull(),
  templateId: uuid('template_id').references(() => smsTemplates.id, { onDelete: 'set null' }),
  recipientFilter: jsonb('recipient_filter'),
  recipientCount: integer('recipient_count').default(0),
  sentCount: integer('sent_count').default(0),
  deliveredCount: integer('delivered_count').default(0),
  failedCount: integer('failed_count').default(0),
  totalCost: decimal('total_cost', { precision: 10, scale: 2 }).default('0.00'),
  status: text('status').notNull().default('draft'),
  scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  createdBy: text('created_by').references(() => profiles.userId, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type SmsCampaign = typeof smsCampaigns.$inferSelect;
export type NewSmsCampaign = typeof smsCampaigns.$inferInsert;

// ============================================================================
// SMS MESSAGES
// ============================================================================

export const smsMessages = pgTable('sms_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => profiles.userId, { onDelete: 'set null' }),
  phoneNumber: text('phone_number').notNull(),
  message: text('message').notNull(),
  templateId: uuid('template_id').references(() => smsTemplates.id, { onDelete: 'set null' }),
  campaignId: uuid('campaign_id').references(() => smsCampaigns.id, { onDelete: 'set null' }),
  status: text('status').notNull().default('pending'),
  twilioSid: text('twilio_sid'),
  errorCode: text('error_code'),
  errorMessage: text('error_message'),
  segments: integer('segments').default(1),
  priceAmount: decimal('price_amount', { precision: 10, scale: 4 }),
  priceCurrency: text('price_currency').default('USD'),
  direction: text('direction').default('outbound'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  failedAt: timestamp('failed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type SmsMessage = typeof smsMessages.$inferSelect;
export type NewSmsMessage = typeof smsMessages.$inferInsert;

// ============================================================================
// SMS CONVERSATIONS (Two-Way SMS)
// ============================================================================

export const smsConversations = pgTable('sms_conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => profiles.userId, { onDelete: 'set null' }),
  phoneNumber: text('phone_number').notNull(),
  direction: text('direction').notNull(),
  message: text('message').notNull(),
  twilioSid: text('twilio_sid'),
  status: text('status').default('received'),
  repliedAt: timestamp('replied_at', { withTimezone: true }),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type SmsConversation = typeof smsConversations.$inferSelect;
export type NewSmsConversation = typeof smsConversations.$inferInsert;

// ============================================================================
// SMS CAMPAIGN RECIPIENTS
// ============================================================================

export const smsCampaignRecipients = pgTable(
  'sms_campaign_recipients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => smsCampaigns.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => profiles.userId, { onDelete: 'set null' }),
    phoneNumber: text('phone_number').notNull(),
    messageId: uuid('message_id').references(() => smsMessages.id, { onDelete: 'set null' }),
    status: text('status').notNull().default('pending'),
    errorMessage: text('error_message'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    campaignPhoneUnique: unique().on(table.campaignId, table.phoneNumber),
  })
);

export type SmsCampaignRecipient = typeof smsCampaignRecipients.$inferSelect;
export type NewSmsCampaignRecipient = typeof smsCampaignRecipients.$inferInsert;

// ============================================================================
// SMS OPT-OUTS (TCPA Compliance)
// ============================================================================

export const smsOptOuts = pgTable(
  'sms_opt_outs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => profiles.userId, { onDelete: 'set null' }),
    phoneNumber: text('phone_number').notNull(),
    optedOutAt: timestamp('opted_out_at', { withTimezone: true }).notNull().defaultNow(),
    optedOutVia: text('opted_out_via'),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    organizationPhoneUnique: unique().on(table.organizationId, table.phoneNumber),
  })
);

export type SmsOptOut = typeof smsOptOuts.$inferSelect;
export type NewSmsOptOut = typeof smsOptOuts.$inferInsert;

// ============================================================================
// RELATIONS
// ============================================================================

export const smsTemplatesRelations = relations(smsTemplates, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [smsTemplates.organizationId],
    references: [organizations.id],
  }),
  creator: one(profiles, {
    fields: [smsTemplates.createdBy],
    references: [profiles.userId],
  }),
  messages: many(smsMessages),
  campaigns: many(smsCampaigns),
}));

export const smsCampaignsRelations = relations(smsCampaigns, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [smsCampaigns.organizationId],
    references: [organizations.id],
  }),
  template: one(smsTemplates, {
    fields: [smsCampaigns.templateId],
    references: [smsTemplates.id],
  }),
  creator: one(profiles, {
    fields: [smsCampaigns.createdBy],
    references: [profiles.userId],
  }),
  messages: many(smsMessages),
  recipients: many(smsCampaignRecipients),
}));

export const smsMessagesRelations = relations(smsMessages, ({ one }) => ({
  organization: one(organizations, {
    fields: [smsMessages.organizationId],
    references: [organizations.id],
  }),
  user: one(profiles, {
    fields: [smsMessages.userId],
    references: [profiles.userId],
  }),
  template: one(smsTemplates, {
    fields: [smsMessages.templateId],
    references: [smsTemplates.id],
  }),
  campaign: one(smsCampaigns, {
    fields: [smsMessages.campaignId],
    references: [smsCampaigns.id],
  }),
}));

export const smsConversationsRelations = relations(smsConversations, ({ one }) => ({
  organization: one(organizations, {
    fields: [smsConversations.organizationId],
    references: [organizations.id],
  }),
  user: one(profiles, {
    fields: [smsConversations.userId],
    references: [profiles.userId],
  }),
}));

export const smsCampaignRecipientsRelations = relations(smsCampaignRecipients, ({ one }) => ({
  campaign: one(smsCampaigns, {
    fields: [smsCampaignRecipients.campaignId],
    references: [smsCampaigns.id],
  }),
  user: one(profiles, {
    fields: [smsCampaignRecipients.userId],
    references: [profiles.userId],
  }),
  message: one(smsMessages, {
    fields: [smsCampaignRecipients.messageId],
    references: [smsMessages.id],
  }),
}));

export const smsOptOutsRelations = relations(smsOptOuts, ({ one }) => ({
  organization: one(organizations, {
    fields: [smsOptOuts.organizationId],
    references: [organizations.id],
  }),
  user: one(profiles, {
    fields: [smsOptOuts.userId],
    references: [profiles.userId],
  }),
}));

