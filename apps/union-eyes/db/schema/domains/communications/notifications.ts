/**
 * Notification Schema
 * 
 * Defines database tables for:
 * - User notification preferences
 * - In-app notifications
 * - Notification history/audit log
 */

import { pgTable, text, timestamp, boolean, jsonb, uuid, pgEnum, integer, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organizations } from '../../../schema-organizations';

// ============================================
// Enums
// ============================================

export const notificationChannelEnum = pgEnum('notification_channel', [
  'email',
  'sms',
  'push',
  'in-app',
  'multi',
]);

export const notificationStatusEnum = pgEnum('notification_status', [
  'sent',
  'failed',
  'partial',
  'pending',
]);

export const notificationTypeEnum = pgEnum('notification_type', [
  'payment_confirmation',
  'payment_failed',
  'payment_reminder',
  'donation_received',
  'stipend_approved',
  'stipend_disbursed',
  'low_balance_alert',
  'arrears_warning',
  'strike_announcement',
  'picket_reminder',
  'claim_update',
  'document_update',
  'deadline_alert',
  'system_announcement',
  'security_alert',
  'general',
]);

export const notificationPriorityEnum = pgEnum('notification_priority', [
  'low',
  'normal',
  'high',
  'urgent',
]);

export const digestFrequencyEnum = pgEnum('digest_frequency', [
  'immediate',
  'daily',
  'weekly',
  'never',
]);

// ============================================
// User Notification Preferences
// ============================================

export const userNotificationPreferences = pgTable('user_notification_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().unique(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Contact info
  email: text('email').notNull(),
  phone: text('phone'),
  
  // Channel preferences
  emailEnabled: boolean('email_enabled').notNull().default(true),
  smsEnabled: boolean('sms_enabled').notNull().default(false),
  pushEnabled: boolean('push_enabled').notNull().default(true),
  inAppEnabled: boolean('in_app_enabled').notNull().default(true),
  
  // Frequency preferences
  digestFrequency: digestFrequencyEnum('digest_frequency').notNull().default('daily'),
  
  // Quiet hours (HH:MM format)
  quietHoursStart: text('quiet_hours_start'), // e.g., "22:00"
  quietHoursEnd: text('quiet_hours_end'), // e.g., "08:00"
  
  // Notification type preferences
  claimUpdates: boolean('claim_updates').notNull().default(true),
  documentUpdates: boolean('document_updates').notNull().default(true),
  deadlineAlerts: boolean('deadline_alerts').notNull().default(true),
  systemAnnouncements: boolean('system_announcements').notNull().default(true),
  securityAlerts: boolean('security_alerts').notNull().default(true),
  
  // Metadata
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// Notification Tracking Table (for NotificationService)
// ============================================

export const notificationTracking = pgTable('notification_tracking', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  recipientId: uuid('recipient_id'),
  
  // Notification type and priority
  type: notificationTypeEnum('type').notNull(),
  status: notificationStatusEnum('status').notNull().default('pending'),
  priority: notificationPriorityEnum('priority').notNull().default('normal'),
  
  // Content
  subject: text('subject'),
  body: text('body').notNull(),
  htmlBody: text('html_body'),
  
  // Template information
  templateId: text('template_id'),
  templateData: jsonb('template_data'),
  
  // Provider information
  providerId: text('provider_id'),
  externalMessageId: text('external_message_id'),
  
  // Action button
  actionUrl: text('action_url'),
  actionLabel: text('action_label'),
  
  // Delivery tracking
  sentAt: timestamp('sent_at'),
  deliveredAt: timestamp('delivered_at'),
  failureReason: text('failure_reason'),
  failureCount: integer('failure_count').default(0),
  lastFailureAt: timestamp('last_failure_at'),
  
  // Additional metadata
  metadata: jsonb('metadata'),
  
  // Tracking fields
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// In-App Notifications
// ============================================

export const inAppNotifications = pgTable('in_app_notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Notification content
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull().default('info'), // info, success, warning, error
  
  // Optional action
  actionLabel: text('action_label'),
  actionUrl: text('action_url'),
  
  // Metadata
  data: jsonb('data'),
  
  // Status
  read: boolean('read').notNull().default(false),
  readAt: timestamp('read_at'),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'), // Optional expiration
}, (table) => ({
  // A system-written notice carries data.dedupeKey, so writing it twice stores it once (migration 20261103).
  dedupeUq: uniqueIndex('uq_in_app_notifications_dedupe').on(table.organizationId, table.userId, sql`(${table.data}->>'dedupeKey')`).where(sql`${table.data} ? 'dedupeKey'`),
}));

// notification_history is not declared in this barrel. The physical relation stays.
// services/financial-service still declares its own notification_history. Do not DROP it.

export type NotificationTracking = typeof notificationTracking.$inferSelect;
export type NewNotificationTracking = typeof notificationTracking.$inferInsert;

// ============================================
// Scheduled Notifications (for deadlines, reminders, etc.)
// ============================================

export const notificationScheduleStatusEnum = pgEnum('notification_schedule_status', [
  'scheduled',
  'sent',
  'cancelled',
  'failed',
]);

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  
  // Notification content
  type: text('type').notNull(), // deadline_reminder, deadline_missed, etc.
  title: text('title').notNull(),
  message: text('message').notNull(),
  priority: text('priority').default('medium'), // critical, high, medium, low
  
  // Related entity
  relatedEntityType: text('related_entity_type'), // grievance_deadline, claim, etc.
  relatedEntityId: text('related_entity_id'),
  
  // Scheduling
  scheduledFor: timestamp('scheduled_for'),
  status: notificationScheduleStatusEnum('status').notNull().default('scheduled'),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  sentAt: timestamp('sent_at'),
});

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

// ============================================
// Types
// ============================================

export type UserNotificationPreferences = typeof userNotificationPreferences.$inferSelect;
export type NewUserNotificationPreferences = typeof userNotificationPreferences.$inferInsert;

export type InAppNotification = typeof inAppNotifications.$inferSelect;
export type NewInAppNotification = typeof inAppNotifications.$inferInsert;

// ============================================
// Notification Templates
// ============================================

export const notificationTemplateStatusEnum = pgEnum('notification_template_status', [
  'active',
  'inactive',
  'draft',
  'archived',
]);

export const notificationTemplateTypeEnum = pgEnum('notification_template_type', [
  'payment',
  'dues',
  'strike',
  'voting',
  'certification',
  'general',
  'system',
]);

export const notificationTemplates = pgTable('notification_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Template identification
  templateKey: text('template_key').notNull().unique(), // PAYMENT_RECEIVED, DUES_REMINDER, etc
  name: text('name').notNull(),
  description: text('description'),
  type: notificationTemplateTypeEnum('type').notNull(),
  
  // Content
  subject: text('subject'),
  title: text('title'),
  bodyTemplate: text('body_template').notNull(),
  htmlBodyTemplate: text('html_body_template'),
  
  // Template variables (JSON array of variable names)
  variables: jsonb('variables'),
  defaultVariables: jsonb('default_variables'),
  
  // Configuration
  channels: notificationChannelEnum('channels').array(),
  status: notificationTemplateStatusEnum('status').notNull().default('active'),
  isSystem: boolean('is_system').notNull().default(false), // Cannot be deleted
  
  // Retry policy
  maxRetries: text('max_retries').default('3'),
  retryDelaySeconds: text('retry_delay_seconds').default('300'),
  
  // Metadata
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: text('created_by'),
  updatedBy: text('updated_by'),
});

// ============================================
// Notification Queue (for async processing)
// ============================================

export const notificationQueueStatusEnum = pgEnum('notification_queue_status', [
  'pending',
  'processing',
  'completed',
  'failed',
  'retrying',
]);

// notificationPriorityEnum already defined above (line 50)

export const notificationQueue = pgTable('notification_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Queue status
  status: notificationQueueStatusEnum('status').notNull().default('pending'),
  priority: notificationPriorityEnum('priority').notNull().default('normal'),
  
  // Payload
  payload: jsonb('payload').notNull(),
  
  // Processing
  attemptCount: text('attempt_count').notNull().default('0'),
  maxAttempts: text('max_attempts').notNull().default('3'),
  nextRetryAt: timestamp('next_retry_at'),
  processedAt: timestamp('processed_at'),
  completedAt: timestamp('completed_at'),
  
  // Results
  resultNotificationId: uuid('result_notification_id'),
  errorMessage: text('error_message'),
  
  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// Notification Delivery Log
// ============================================

export const notificationDeliveryLog = pgTable('notification_delivery_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  notificationId: uuid('notification_id').notNull(),
  
  // Event details
  event: text('event').notNull(), // sent, delivered, bounced, complained, opened, clicked
  eventTimestamp: timestamp('event_timestamp').notNull(),
  
  // Provider details
  providerId: text('provider_id'), // sendgrid, twilio, firebase
  externalEventId: text('external_event_id'),
  
  // Details
  details: jsonb('details'),
  statusCode: text('status_code'),
  errorMessage: text('error_message'),
  
  // Metadata
  metadata: jsonb('metadata'),
  
  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ============================================
// Notification Bounces (suppression list)
// ============================================

export const notificationBounceTypeEnum = pgEnum('notification_bounce_type', [
  'permanent',
  'temporary',
  'complaint',
  'manual',
]);

// ============================================
// Indexes
// ============================================

// Create indexes for common queries
// These would be created in a migration file:
//
// CREATE INDEX idx_user_notifications_user_id ON user_notification_preferences(user_id);
// CREATE INDEX idx_user_notifications_organization_id ON user_notification_preferences(organization_id);
// 
// CREATE INDEX idx_in_app_notifications_user_id ON in_app_notifications(user_id);
// CREATE INDEX idx_in_app_notifications_user_read ON in_app_notifications(user_id, read);
// CREATE INDEX idx_in_app_notifications_created_at ON in_app_notifications(created_at DESC);
// 
// CREATE INDEX idx_notification_history_user_id ON notification_history(user_id);
// CREATE INDEX idx_notification_history_organization_id ON notification_history(organization_id);
// CREATE INDEX idx_notification_history_sent_at ON notification_history(sent_at DESC);
// CREATE INDEX idx_notification_history_status ON notification_history(status);
//
// CREATE INDEX idx_notification_templates_key ON notification_templates(template_key);
// CREATE INDEX idx_notification_templates_status ON notification_templates(status);
//
// CREATE INDEX idx_notification_queue_status ON notification_queue(status);
// CREATE INDEX idx_notification_queue_retry ON notification_queue(next_retry_at);
//
// CREATE INDEX idx_notification_bounces_email ON notification_bounces(email);
// CREATE INDEX idx_notification_bounces_active ON notification_bounces(is_active);

