/**
 * Push Notifications Schema
 * Drizzle ORM schema for push notification functionality with FCM integration
 */

import { relations } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
  time,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { organizations } from '../schema-organizations';
import { profiles } from './profiles-schema';

// =============================================
// ENUMS
// =============================================

export const pushPlatformEnum = pgEnum('push_platform', ['ios', 'android', 'web']);

export const pushNotificationStatusEnum = pgEnum('push_notification_status', [
  'draft',
  'scheduled',
  'sending',
  'sent',
  'failed',
  'cancelled',
]);

export const pushDeliveryStatusEnum = pgEnum('push_delivery_status', [
  'pending',
  'sent',
  'delivered',
  'failed',
  'clicked',
  'dismissed',
]);

export const pushPriorityEnum = pgEnum('push_priority', ['low', 'normal', 'high', 'urgent']);

// =============================================
// TABLES
// =============================================

/**
 * Device tokens for push notifications
 * Stores FCM registration tokens with device metadata and preferences
 */
export const pushDevices = pgTable(
  'push_devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.userId, { onDelete: 'cascade' }),

    // Device information
    deviceToken: text('device_token').notNull().unique(),
    platform: pushPlatformEnum('platform').notNull(),
    deviceName: text('device_name'),
    deviceModel: text('device_model'),
    osVersion: text('os_version'),
    appVersion: text('app_version'),

    // Notification preferences
    enabled: boolean('enabled').notNull().default(true),
    quietHoursStart: time('quiet_hours_start'),
    quietHoursEnd: time('quiet_hours_end'),
    timezone: text('timezone').default('UTC'),

    // Metadata
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    organizationIdx: index('idx_push_devices_organization').on(table.organizationId),
    profileIdx: index('idx_push_devices_profile').on(table.profileId),
    tokenIdx: index('idx_push_devices_token').on(table.deviceToken),
    platformIdx: index('idx_push_devices_platform').on(table.platform),
    enabledIdx: index('idx_push_devices_enabled').on(table.enabled),
    lastActiveIdx: index('idx_push_devices_last_active').on(table.lastActiveAt),
    uniqueDevicePerProfile: unique('unique_device_per_profile').on(table.profileId, table.deviceToken),
  })
);

/**
 * Push notification templates
 * Reusable notification templates with content and action configuration
 */
export const pushNotificationTemplates = pgTable(
  'push_notification_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // Template information
    name: text('name').notNull(),
    description: text('description'),
    category: text('category'),

    // Notification content
    title: text('title').notNull(),
    body: text('body').notNull(),
    iconUrl: text('icon_url'),
    imageUrl: text('image_url'),
    badgeCount: integer('badge_count'),
    sound: text('sound').default('default'),

    // Action configuration
    clickAction: text('click_action'),
    actionButtons: jsonb('action_buttons').$type<
      Array<{
        id: string;
        title: string;
        action: string;
      }>
    >(),

    // Variables and personalization
    variables: jsonb('variables').$type<
      Array<{
        key: string;
        label: string;
        example: string;
      }>
    >(),

    // Template settings
    priority: pushPriorityEnum('priority').default('normal'),
    ttl: integer('ttl').default(86400),
    isSystem: boolean('is_system').notNull().default(false),

    // Metadata
    createdBy: text('created_by').references(() => profiles.userId),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    organizationIdx: index('idx_push_templates_organization').on(table.organizationId),
    categoryIdx: index('idx_push_templates_category').on(table.category),
    systemIdx: index('idx_push_templates_system').on(table.isSystem),
    createdIdx: index('idx_push_templates_created').on(table.createdAt),
  })
);

/**
 * Push notification campaigns
 * Campaign management with targeting, scheduling, and statistics
 */
export const pushNotifications = pgTable(
  'push_notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // Campaign information
    name: text('name').notNull(),
    templateId: uuid('template_id').references(() => pushNotificationTemplates.id, {
      onDelete: 'set null',
    }),

    // Notification content
    title: text('title').notNull(),
    body: text('body').notNull(),
    iconUrl: text('icon_url'),
    imageUrl: text('image_url'),
    badgeCount: integer('badge_count'),
    sound: text('sound').default('default'),

    // Action configuration
    clickAction: text('click_action'),
    actionButtons: jsonb('action_buttons').$type<
      Array<{
        id: string;
        title: string;
        action: string;
      }>
    >(),

    // Targeting
    targetType: text('target_type').notNull(), // 'all', 'segment', 'devices', 'topics'
    targetCriteria: jsonb('target_criteria').$type<{
      roles?: string[];
      statuses?: string[];
      tags?: string[];
      dateRange?: { start: string; end: string };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      customFields?: Record<string, any>;
    }>(),
    deviceIds: uuid('device_ids').array(),
    topics: text('topics').array(),

    // Scheduling
    status: pushNotificationStatusEnum('status').notNull().default('draft'),
    priority: pushPriorityEnum('priority').default('normal'),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    timezone: text('timezone').default('UTC'),
    ttl: integer('ttl').default(86400),

    // Statistics
    totalTargeted: integer('total_targeted').default(0),
    totalSent: integer('total_sent').default(0),
    totalDelivered: integer('total_delivered').default(0),
    totalFailed: integer('total_failed').default(0),
    totalClicked: integer('total_clicked').default(0),
    totalDismissed: integer('total_dismissed').default(0),

    // Metadata
    createdBy: text('created_by').references(() => profiles.userId),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    organizationIdx: index('idx_push_notifications_organization').on(table.organizationId),
    templateIdx: index('idx_push_notifications_template').on(table.templateId),
    statusIdx: index('idx_push_notifications_status').on(table.status),
    scheduledIdx: index('idx_push_notifications_scheduled').on(table.scheduledAt),
    targetTypeIdx: index('idx_push_notifications_target_type').on(table.targetType),
    createdIdx: index('idx_push_notifications_created').on(table.createdAt),
  })
);

/**
 * Push notification deliveries
 * Tracks delivery status and engagement for individual devices
 */
export const pushDeliveries = pgTable(
  'push_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    notificationId: uuid('notification_id')
      .notNull()
      .references(() => pushNotifications.id, { onDelete: 'cascade' }),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => pushDevices.id, { onDelete: 'cascade' }),

    // Delivery information
    status: pushDeliveryStatusEnum('status').notNull().default('pending'),
    fcmMessageId: text('fcm_message_id'),

    // Timeline
    sentAt: timestamp('sent_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    clickedAt: timestamp('clicked_at', { withTimezone: true }),
    dismissedAt: timestamp('dismissed_at', { withTimezone: true }),

    // Error handling
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    retryCount: integer('retry_count').default(0),

    // Engagement data
    eventData: jsonb('event_data').$type<{
      clickAction?: string;
      timeToClick?: number;
      buttonId?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [key: string]: any;
    }>(),

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    notificationIdx: index('idx_push_deliveries_notification').on(table.notificationId),
    deviceIdx: index('idx_push_deliveries_device').on(table.deviceId),
    statusIdx: index('idx_push_deliveries_status').on(table.status),
    sentIdx: index('idx_push_deliveries_sent').on(table.sentAt),
    clickedIdx: index('idx_push_deliveries_clicked').on(table.clickedAt),
    uniqueDelivery: unique('unique_delivery').on(table.notificationId, table.deviceId),
  })
);

// =============================================
// RELATIONS
// =============================================

export const pushDevicesRelations = relations(pushDevices, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [pushDevices.organizationId],
    references: [organizations.id],
  }),
  profile: one(profiles, {
    fields: [pushDevices.profileId],
    references: [profiles.userId],
  }),
  deliveries: many(pushDeliveries),
}));

export const pushNotificationTemplatesRelations = relations(
  pushNotificationTemplates,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [pushNotificationTemplates.organizationId],
      references: [organizations.id],
    }),
    createdByProfile: one(profiles, {
      fields: [pushNotificationTemplates.createdBy],
      references: [profiles.userId],
    }),
    notifications: many(pushNotifications),
  })
);

export const pushNotificationsRelations = relations(pushNotifications, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [pushNotifications.organizationId],
    references: [organizations.id],
  }),
  template: one(pushNotificationTemplates, {
    fields: [pushNotifications.templateId],
    references: [pushNotificationTemplates.id],
  }),
  createdByProfile: one(profiles, {
    fields: [pushNotifications.createdBy],
    references: [profiles.userId],
  }),
  deliveries: many(pushDeliveries),
}));

export const pushDeliveriesRelations = relations(pushDeliveries, ({ one }) => ({
  notification: one(pushNotifications, {
    fields: [pushDeliveries.notificationId],
    references: [pushNotifications.id],
  }),
  device: one(pushDevices, {
    fields: [pushDeliveries.deviceId],
    references: [pushDevices.id],
  }),
}));

// =============================================
// INFERRED TYPES
// =============================================

export type PushDevice = typeof pushDevices.$inferSelect;
export type NewPushDevice = typeof pushDevices.$inferInsert;

export type PushNotificationTemplate = typeof pushNotificationTemplates.$inferSelect;
export type NewPushNotificationTemplate = typeof pushNotificationTemplates.$inferInsert;

export type PushNotification = typeof pushNotifications.$inferSelect;
export type NewPushNotification = typeof pushNotifications.$inferInsert;

export type PushDelivery = typeof pushDeliveries.$inferSelect;
export type NewPushDelivery = typeof pushDeliveries.$inferInsert;

