/**
 * Communication Analytics Schema
 * 
 * Drizzle ORM schema definitions for tracking communication effectiveness:
 * - Analytics: Daily/weekly summary statistics by channel
 * - Engagement Scores: User-level engagement tracking across all channels
 * - Preferences: Consolidated communication preferences
 * 
 * Dependencies: organizations, profiles, newsletters, SMS, push notifications
 * Version: 1.0.0
 * Created: December 6, 2025
 */

import { relations } from 'drizzle-orm';
import {
  boolean,
  date,
  decimal,
  integer,
  pgEnum,
  pgTable,
  time,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { profiles } from './profiles-schema';
import { organizations } from '../schema-organizations';

// ============================================================================
// ENUMS
// ============================================================================

export const communicationChannelEnum = pgEnum('communication_channel', [
  'email',
  'sms',
  'push',
  'newsletter',
  'in_app',
]);

// ============================================================================
// TABLES
// ============================================================================

/**
 * Communication Analytics
 * Daily summary of communication metrics by channel
 */
export const communicationAnalytics = pgTable('communication_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  channel: communicationChannelEnum('channel').notNull(),
  
  // Volume metrics
  messagesSent: integer('messages_sent').default(0),
  messagesDelivered: integer('messages_delivered').default(0),
  messagesFailed: integer('messages_failed').default(0),
  messagesOpened: integer('messages_opened').default(0),
  messagesClicked: integer('messages_clicked').default(0),
  uniqueRecipients: integer('unique_recipients').default(0),
  
  // Negative metrics
  optOuts: integer('opt_outs').default(0),
  bounces: integer('bounces').default(0),
  complaints: integer('complaints').default(0),
  
  // Calculated rates (percentages)
  engagementRate: decimal('engagement_rate', { precision: 5, scale: 2 }),
  deliveryRate: decimal('delivery_rate', { precision: 5, scale: 2 }),
  openRate: decimal('open_rate', { precision: 5, scale: 2 }),
  clickRate: decimal('click_rate', { precision: 5, scale: 2 }),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

/**
 * User Engagement Scores
 * Track individual user engagement across all communication channels
 */
export const userEngagementScores = pgTable('user_engagement_scores', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 255 }) // User ID - matches users.userId VARCHAR(255)
    .notNull()
    .references(() => profiles.userId, { onDelete: 'cascade' }),
  
  // Engagement scores (0-100)
  overallScore: integer('overall_score').default(0),
  emailScore: integer('email_score').default(0),
  smsScore: integer('sms_score').default(0),
  pushScore: integer('push_score').default(0),
  
  // Last activity timestamps
  lastEmailOpen: timestamp('last_email_open', { withTimezone: true }),
  lastSmsReply: timestamp('last_sms_reply', { withTimezone: true }),
  lastPushOpen: timestamp('last_push_open', { withTimezone: true }),
  
  // Cumulative metrics - Email
  totalEmailsReceived: integer('total_emails_received').default(0),
  totalEmailsOpened: integer('total_emails_opened').default(0),
  
  // Cumulative metrics - SMS
  totalSmsReceived: integer('total_sms_received').default(0),
  totalSmsReplied: integer('total_sms_replied').default(0),
  
  // Cumulative metrics - Push
  totalPushReceived: integer('total_push_received').default(0),
  totalPushOpened: integer('total_push_opened').default(0),
  
  calculatedAt: timestamp('calculated_at', { withTimezone: true }).defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

/**
 * Communication Preferences
 * Consolidated user preferences for all communication channels
 */
export const communicationPreferences = pgTable('communication_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 255 }) // User ID - matches users.userId VARCHAR(255)
    .notNull()
    .references(() => profiles.userId, { onDelete: 'cascade' }),
  
  // Channel preferences
  emailEnabled: boolean('email_enabled').default(true),
  smsEnabled: boolean('sms_enabled').default(true),
  pushEnabled: boolean('push_enabled').default(true),
  newsletterEnabled: boolean('newsletter_enabled').default(true),
  marketingEnabled: boolean('marketing_enabled').default(false),
  
  // Topic preferences
  grievanceUpdates: boolean('grievance_updates').default(true),
  trainingReminders: boolean('training_reminders').default(true),
  deadlineAlerts: boolean('deadline_alerts').default(true),
  strikeFundUpdates: boolean('strike_fund_updates').default(true),
  duesReminders: boolean('dues_reminders').default(true),
  
  // Quiet hours
  quietHoursStart: time('quiet_hours_start'),
  quietHoursEnd: time('quiet_hours_end'),
  timezone: varchar('timezone', { length: 50 }).default('UTC'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const communicationAnalyticsRelations = relations(
  communicationAnalytics,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [communicationAnalytics.organizationId],
      references: [organizations.id],
    }),
  })
);

export const userEngagementScoresRelations = relations(
  userEngagementScores,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [userEngagementScores.organizationId],
      references: [organizations.id],
    }),
    user: one(profiles, {
      fields: [userEngagementScores.userId],
      references: [profiles.userId],
    }),
  })
);

export const communicationPreferencesRelations = relations(
  communicationPreferences,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [communicationPreferences.organizationId],
      references: [organizations.id],
    }),
    user: one(profiles, {
      fields: [communicationPreferences.userId],
      references: [profiles.userId],
    }),
  })
);

// ============================================================================
// TYPESCRIPT TYPES
// ============================================================================

export type CommunicationAnalytics = typeof communicationAnalytics.$inferSelect;
export type NewCommunicationAnalytics = typeof communicationAnalytics.$inferInsert;

export type UserEngagementScore = typeof userEngagementScores.$inferSelect;
export type NewUserEngagementScore = typeof userEngagementScores.$inferInsert;

export type CommunicationPreference = typeof communicationPreferences.$inferSelect;
export type NewCommunicationPreference = typeof communicationPreferences.$inferInsert;

