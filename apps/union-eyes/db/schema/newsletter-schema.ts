/**
 * Newsletter System Schema
 * 
 * Drizzle ORM schema definitions for newsletter/email campaign system:
 * - Templates: Reusable email templates with variables
 * - Distribution Lists: Subscriber groups for targeted campaigns
 * - Campaigns: Newsletter campaigns with scheduling and tracking
 * - Recipients: Individual delivery records
 * - Engagement: Opens, clicks, unsubscribes, spam reports
 * 
 * Dependencies: organizations, profiles from base schema
 * Version: 1.0.0
 * Created: December 6, 2025
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
  inet,
} from 'drizzle-orm/pg-core';
import { profiles } from './profiles-schema';
import { organizations } from '../schema-organizations';

// ============================================================================
// ENUMS
// ============================================================================

export const templateCategoryEnum = pgEnum('template_category', [
  'general',
  'announcement',
  'event',
  'update',
  'custom',
]);

export const listTypeEnum = pgEnum('newsletter_list_type', [
  'manual',
  'dynamic',
  'segment',
]);

export const subscriberStatusEnum = pgEnum('newsletter_subscriber_status', [
  'subscribed',
  'unsubscribed',
  'bounced',
]);

export const campaignStatusEnum = pgEnum('newsletter_campaign_status', [
  'draft',
  'scheduled',
  'sending',
  'sent',
  'paused',
  'cancelled',
]);

export const recipientStatusEnum = pgEnum('newsletter_recipient_status', [
  'pending',
  'sent',
  'delivered',
  'bounced',
  'failed',
]);

export const bounceTypeEnum = pgEnum('newsletter_bounce_type', [
  'hard',
  'soft',
  'technical',
]);

export const engagementEventEnum = pgEnum('newsletter_engagement_event', [
  'open',
  'click',
  'unsubscribe',
  'spam_report',
]);

// ============================================================================
// TABLES
// ============================================================================

/**
 * Newsletter Templates
 * Reusable email templates with HTML content, JSON structure, and variables
 */
export const newsletterTemplates = pgTable('newsletter_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }),
  thumbnailUrl: text('thumbnail_url'),
  htmlContent: text('html_content').notNull(),
  jsonStructure: jsonb('json_structure'), // Block-based editor structure
  variables: jsonb('variables').$type<TemplateVariable[]>().default([]),
  isSystem: boolean('is_system').default(false),
  isActive: boolean('is_active').default(true),
  usageCount: integer('usage_count').default(0),
  createdBy: text('created_by').references(() => profiles.userId, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

/**
 * Distribution Lists
 * Subscriber groups for targeted newsletter campaigns
 */
export const newsletterDistributionLists = pgTable(
  'newsletter_distribution_lists',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    listType: varchar('list_type', { length: 50 }).default('manual'),
    filterCriteria: jsonb('filter_criteria').$type<ListFilterCriteria>(),
    subscriberCount: integer('subscriber_count').default(0),
    isActive: boolean('is_active').default(true),
    createdBy: text('created_by').references(() => profiles.userId, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  }
);

/**
 * Distribution List Subscribers
 * Many-to-many relationship between lists and profiles
 */
export const newsletterListSubscribers = pgTable(
  'newsletter_list_subscribers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    listId: uuid('list_id')
      .notNull()
      .references(() => newsletterDistributionLists.id, {
        onDelete: 'cascade',
      }),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.userId, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    status: varchar('status', { length: 50 }).default('subscribed'),
    subscribedAt: timestamp('subscribed_at', { withTimezone: true }).defaultNow(),
    unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
  }
);

/**
 * Newsletter Campaigns
 * Main newsletter/email campaign entity with scheduling and tracking
 */
export const newsletterCampaigns = pgTable('newsletter_campaigns', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  templateId: uuid('template_id').references(() => newsletterTemplates.id, {
    onDelete: 'set null',
  }),
  name: varchar('name', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 500 }).notNull(),
  previewText: varchar('preview_text', { length: 500 }),
  fromName: varchar('from_name', { length: 255 }).notNull(),
  fromEmail: varchar('from_email', { length: 255 }).notNull(),
  replyToEmail: varchar('reply_to_email', { length: 255 }),
  htmlContent: text('html_content').notNull(),
  jsonStructure: jsonb('json_structure'), // Editor structure
  status: varchar('status', { length: 50 }).default('draft'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  timezone: varchar('timezone', { length: 100 }).default('UTC'),

  // Distribution
  distributionListIds: uuid('distribution_list_ids').array().default([]),
  recipientCount: integer('recipient_count').default(0),

  // Tracking stats
  totalSent: integer('total_sent').default(0),
  totalDelivered: integer('total_delivered').default(0),
  totalBounced: integer('total_bounced').default(0),
  totalOpened: integer('total_opened').default(0),
  totalClicked: integer('total_clicked').default(0),
  totalUnsubscribed: integer('total_unsubscribed').default(0),
  totalSpamReports: integer('total_spam_reports').default(0),

  // Metadata
  tags: varchar('tags', { length: 100 }).array(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
  createdBy: text('created_by').references(() => profiles.userId, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

/**
 * Newsletter Recipients
 * Individual recipient records with delivery status
 */
export const newsletterRecipients = pgTable('newsletter_recipients', {
  id: uuid('id').defaultRandom().primaryKey(),
  campaignId: uuid('campaign_id')
    .notNull()
    .references(() => newsletterCampaigns.id, { onDelete: 'cascade' }),
  profileId: text('profile_id').references(() => profiles.userId, {
    onDelete: 'set null',
  }),
  email: varchar('email', { length: 255 }).notNull(),
  status: varchar('status', { length: 50 }).default('pending'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  bouncedAt: timestamp('bounced_at', { withTimezone: true }),
  bounceType: varchar('bounce_type', { length: 50 }),
  bounceReason: text('bounce_reason'),
  errorMessage: text('error_message'),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

/**
 * Newsletter Engagement
 * Tracks opens, clicks, unsubscribes, spam reports
 */
export const newsletterEngagement = pgTable('newsletter_engagement', {
  id: uuid('id').defaultRandom().primaryKey(),
  campaignId: uuid('campaign_id')
    .notNull()
    .references(() => newsletterCampaigns.id, { onDelete: 'cascade' }),
  recipientId: uuid('recipient_id')
    .notNull()
    .references(() => newsletterRecipients.id, { onDelete: 'cascade' }),
  profileId: text('profile_id').references(() => profiles.userId, {
    onDelete: 'set null',
  }),
  eventType: varchar('event_type', { length: 50 }).notNull(),
  eventData: jsonb('event_data').$type<EngagementEventData>(),
  ipAddress: inet('ip_address'),
  userAgent: text('user_agent'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow(),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const newsletterTemplatesRelations = relations(
  newsletterTemplates,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [newsletterTemplates.organizationId],
      references: [organizations.id],
    }),
    creator: one(profiles, {
      fields: [newsletterTemplates.createdBy],
      references: [profiles.userId],
    }),
    campaigns: many(newsletterCampaigns),
  })
);

export const newsletterDistributionListsRelations = relations(
  newsletterDistributionLists,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [newsletterDistributionLists.organizationId],
      references: [organizations.id],
    }),
    creator: one(profiles, {
      fields: [newsletterDistributionLists.createdBy],
      references: [profiles.userId],
    }),
    subscribers: many(newsletterListSubscribers),
  })
);

export const newsletterListSubscribersRelations = relations(
  newsletterListSubscribers,
  ({ one }) => ({
    list: one(newsletterDistributionLists, {
      fields: [newsletterListSubscribers.listId],
      references: [newsletterDistributionLists.id],
    }),
    profile: one(profiles, {
      fields: [newsletterListSubscribers.profileId],
      references: [profiles.userId],
    }),
  })
);

export const newsletterCampaignsRelations = relations(
  newsletterCampaigns,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [newsletterCampaigns.organizationId],
      references: [organizations.id],
    }),
    template: one(newsletterTemplates, {
      fields: [newsletterCampaigns.templateId],
      references: [newsletterTemplates.id],
    }),
    creator: one(profiles, {
      fields: [newsletterCampaigns.createdBy],
      references: [profiles.userId],
    }),
    recipients: many(newsletterRecipients),
    engagement: many(newsletterEngagement),
  })
);

export const newsletterRecipientsRelations = relations(
  newsletterRecipients,
  ({ one, many }) => ({
    campaign: one(newsletterCampaigns, {
      fields: [newsletterRecipients.campaignId],
      references: [newsletterCampaigns.id],
    }),
    profile: one(profiles, {
      fields: [newsletterRecipients.profileId],
      references: [profiles.userId],
    }),
    engagement: many(newsletterEngagement),
  })
);

export const newsletterEngagementRelations = relations(
  newsletterEngagement,
  ({ one }) => ({
    campaign: one(newsletterCampaigns, {
      fields: [newsletterEngagement.campaignId],
      references: [newsletterCampaigns.id],
    }),
    recipient: one(newsletterRecipients, {
      fields: [newsletterEngagement.recipientId],
      references: [newsletterRecipients.id],
    }),
    profile: one(profiles, {
      fields: [newsletterEngagement.profileId],
      references: [profiles.userId],
    }),
  })
);

// ============================================================================
// TYPES
// ============================================================================

export type NewsletterTemplate = typeof newsletterTemplates.$inferSelect;
export type NewNewsletterTemplate = typeof newsletterTemplates.$inferInsert;

export type NewsletterDistributionList =
  typeof newsletterDistributionLists.$inferSelect;
export type NewNewsletterDistributionList =
  typeof newsletterDistributionLists.$inferInsert;

export type NewsletterListSubscriber =
  typeof newsletterListSubscribers.$inferSelect;
export type NewNewsletterListSubscriber =
  typeof newsletterListSubscribers.$inferInsert;

export type NewsletterCampaign = typeof newsletterCampaigns.$inferSelect;
export type NewNewsletterCampaign = typeof newsletterCampaigns.$inferInsert;

export type NewsletterRecipient = typeof newsletterRecipients.$inferSelect;
export type NewNewsletterRecipient = typeof newsletterRecipients.$inferInsert;

export type NewsletterEngagement = typeof newsletterEngagement.$inferSelect;
export type NewNewsletterEngagement = typeof newsletterEngagement.$inferInsert;

// Helper types for JSONB fields
export interface TemplateVariable {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'image' | 'url';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default?: any;
  required?: boolean;
  description?: string;
}

export interface ListFilterCriteria {
  roles?: string[];
  statuses?: string[];
  tags?: string[];
  joinedAfter?: string;
  joinedBefore?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customFields?: Record<string, any>;
}

export interface EngagementEventData {
  url?: string; // For click events
  linkText?: string; // For click events
  reason?: string; // For unsubscribe/spam
  location?: {
    // Geolocation
    country?: string;
    region?: string;
    city?: string;
  };
  device?: {
    // Device info
    type?: 'desktop' | 'mobile' | 'tablet';
    os?: string;
    browser?: string;
  };
}

// Campaign statistics helper type
export interface CampaignStats {
  sent: number;
  delivered: number;
  bounced: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
  spamReports: number;
  deliveryRate: number; // delivered / sent
  openRate: number; // opened / delivered
  clickRate: number; // clicked / delivered
  clickToOpenRate: number; // clicked / opened
  bounceRate: number; // bounced / sent
  unsubscribeRate: number; // unsubscribed / delivered
}

