/**
 * Mobile Devices Database Schema
 * 
 * Stores device registrations for push notifications
 * and mobile app management
 */

import { pgTable, uuid, varchar, timestamp, boolean, text, jsonb, index, integer } from 'drizzle-orm/pg-core';
import { organizations } from '../schema-organizations';

/**
 * Mobile devices table
 * Tracks registered devices for push notifications
 */
export const mobileDevices = pgTable('mobile_devices', {
  // Primary key
  id: uuid('id').defaultRandom().primaryKey(),
  
  // Device identification
  deviceToken: varchar('device_token', { length: 512 }).notNull().unique(),
  deviceId: varchar('device_id', { length: 255 }).notNull().unique(), // UUID from device
  
  // User association
  userId: varchar('user_id', { length: 255 }).notNull(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Platform info
  platform: varchar('platform', { length: 20 }).notNull(), // 'ios', 'android', 'pwa'
  deviceName: varchar('device_name', { length: 255 }),
  deviceModel: varchar('device_model', { length: 100 }),
  osVersion: varchar('os_version', { length: 50 }),
  appVersion: varchar('app_version', { length: 20 }),
  
  // Push configuration
  pushEnabled: boolean('push_enabled').default(true),
  notificationSound: boolean('notification_sound').default(true),
  notificationVibration: boolean('notification_vibration').default(true),
  
  // Location/timezone
  timezone: varchar('timezone', { length: 50 }).default('UTC'),
  locale: varchar('locale', { length: 10 }).default('en-US'),
  
  // Capabilities
  capabilities: jsonb('capabilities').$type<{
    camera: boolean;
    gps: boolean;
    biometric: boolean;
    push: boolean;
  }>().default({ camera: true, gps: true, biometric: true, push: true }),
  
  // Compliance
  isCompliant: boolean('is_compliant').default(true),
  complianceIssues: jsonb('compliance_issues').$type<string[]>().default([]),
  lastComplianceCheck: timestamp('last_compliance_check'),
  
  // Security
  isJailbroken: boolean('is_jailbroken').default(false),
  lastSecureAt: timestamp('last_secure_at'),
  
  // Status
  isActive: boolean('is_active').default(true),
  isArchived: boolean('is_archived').default(false),
  
  // Timestamps
  registeredAt: timestamp('registered_at').defaultNow().notNull(),
  lastActiveAt: timestamp('last_active_at').defaultNow(),
  archivedAt: timestamp('archived_at'),
  
  // Metadata
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
}, (table) => [
  // Indexes for common queries
  index('idx_mobile_devices_user_id').on(table.userId),
  index('idx_mobile_devices_organization_id').on(table.organizationId),
  index('idx_mobile_devices_platform').on(table.platform),
  index('idx_mobile_devices_is_active').on(table.isActive),
  index('idx_mobile_devices_device_token').on(table.deviceToken),
  index('idx_mobile_devices_last_active').on(table.lastActiveAt),
]);

/**
 * Mobile notifications log
 * Tracks all push notifications sent
 */
export const mobileNotifications = pgTable('mobile_notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  // Reference
  deviceId: uuid('device_id').references(() => mobileDevices.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 255 }).notNull(),
  organizationId: uuid('organization_id'),
  
  // Notification details
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body'),
  data: jsonb('data').$type<Record<string, unknown>>().default({}),
  
  // Delivery
  priority: varchar('priority', { length: 20 }).default('normal'), // 'high', 'normal'
  badge: integer('badge'),
  sound: varchar('sound', { length: 100 }),
  
  // Status
  status: varchar('status', { length: 20 }).notNull(), // 'pending', 'sent', 'delivered', 'failed'
  providerResponse: jsonb('provider_response').$type<Record<string, unknown>>().default({}),
  
  // Timestamps
  scheduledAt: timestamp('scheduled_at'),
  sentAt: timestamp('sent_at'),
  deliveredAt: timestamp('delivered_at'),
  failedAt: timestamp('failed_at'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_mobile_notifications_device_id').on(table.deviceId),
  index('idx_mobile_notifications_user_id').on(table.userId),
  index('idx_mobile_notifications_status').on(table.status),
  index('idx_mobile_notifications_created').on(table.createdAt),
]);

/**
 * Mobile offline sync queue
 * Stores pending operations for offline devices
 */
export const mobileSyncQueue = pgTable('mobile_sync_queue', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  // Device reference
  deviceId: uuid('device_id').references(() => mobileDevices.id, { onDelete: 'cascade' }),
  
  // Sync details
  entityType: varchar('entity_type', { length: 100 }).notNull(), // 'claim', 'member', 'grievance', etc.
  orgId: varchar('org_id', { length: 255 }).notNull(),
  operation: varchar('operation', { length: 20 }).notNull(), // 'create', 'update', 'delete'
  
  // Payload
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  clientTimestamp: timestamp('client_timestamp').notNull(),
  
  // Status
  status: varchar('status', { length: 20 }).default('pending'), // 'pending', 'processing', 'synced', 'failed', 'conflict'
  errorMessage: text('error_message'),
  
  // Conflict resolution
  conflictType: varchar('conflict_type', { length: 50 }), // 'version', 'data', 'delete'
  resolution: varchar('resolution', { length: 20 }), // 'client_wins', 'server_wins', 'merged'
  
  // Retry tracking
  retryCount: integer('retry_count').default(0),
  maxRetries: integer('max_retries').default(3),
  
  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  processedAt: timestamp('processed_at'),
}, (table) => [
  index('idx_mobile_sync_queue_device_id').on(table.deviceId),
  index('idx_mobile_sync_queue_status').on(table.status),
  index('idx_mobile_sync_queue_entity').on(table.entityType, table.orgId),
  index('idx_mobile_sync_queue_created').on(table.createdAt),
]);

/**
 * Mobile analytics events
 * Stores mobile-specific analytics
 */
export const mobileAnalytics = pgTable('mobile_analytics', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  // Session tracking
  sessionId: varchar('session_id', { length: 255 }).notNull(),
  
  // Device/user
  deviceId: uuid('device_id').references(() => mobileDevices.id, { onDelete: 'set null' }),
  userId: varchar('user_id', { length: 255 }),
  organizationId: uuid('organization_id'),
  
  // Event
  eventName: varchar('event_name', { length: 100 }).notNull(),
  eventType: varchar('event_type', { length: 50 }).notNull(), // 'session', 'screen', 'action', 'error', 'performance'
  
  // Properties
  properties: jsonb('properties').$type<Record<string, unknown>>().default({}),
  
  // Location
  location: jsonb('location').$type<{
    latitude: number;
    longitude: number;
    accuracy: number;
  }>(),
  
  // Device context
  deviceContext: jsonb('device_context').$type<{
    platform: string;
    osVersion: string;
    appVersion: string;
    networkType: string;
    locale: string;
  }>(),
  
  // Timestamp
  timestamp: timestamp('timestamp').defaultNow().notNull(),
}, (table) => [
  index('idx_mobile_analytics_session').on(table.sessionId),
  index('idx_mobile_analytics_device').on(table.deviceId),
  index('idx_mobile_analytics_event').on(table.eventName),
  index('idx_mobile_analytics_timestamp').on(table.timestamp),
  index('idx_mobile_analytics_user').on(table.userId),
]);

/**
 * Mobile app configuration
 * Stores app-wide settings per organization
 */
export const mobileAppConfig = pgTable('mobile_app_config', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).unique(),
  
  // App settings
  appName: varchar('app_name', { length: 100 }),
  appIcon: varchar('app_icon', { length: 500 }),
  
  // Push settings
  pushEnabled: boolean('push_enabled').default(true),
  notificationTypes: jsonb('notification_types').$type<{
    claims: boolean;
    dues: boolean;
    meetings: boolean;
    bargaining: boolean;
    strike: boolean;
    general: boolean;
  }>().default({
    claims: true, dues: true, meetings: true, 
    bargaining: true, strike: true, general: true
  }),
  
  // Offline settings
  offlineEnabled: boolean('offline_enabled').default(true),
  offlineDataRetention: integer('offline_data_retention').default(30), // days
  syncOnWifiOnly: boolean('sync_on_wifi_only').default(false),
  
  // Security settings
  biometricEnabled: boolean('biometric_enabled').default(true),
  sessionTimeout: integer('session_timeout').default(30), // minutes
  requirePinOnLaunch: boolean('require_pin_on_launch').default(false),
  
  // Maintenance
  minAppVersion: varchar('min_app_version', { length: 20 }),
  forceUpdateVersion: varchar('force_update_version', { length: 20 }),
  forceUpdateMessage: text('force_update_message'),
  
  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Type exports
export type MobileDevice = typeof mobileDevices.$inferSelect;
export type NewMobileDevice = typeof mobileDevices.$inferInsert;
export type MobileNotification = typeof mobileNotifications.$inferSelect;
export type NewMobileNotification = typeof mobileNotifications.$inferInsert;
export type MobileSyncRecord = typeof mobileSyncQueue.$inferSelect;
export type NewMobileSyncRecord = typeof mobileSyncQueue.$inferInsert;
export type MobileAnalyticsEvent = typeof mobileAnalytics.$inferSelect;
export type NewMobileAnalyticsEvent = typeof mobileAnalytics.$inferInsert;
export type MobileAppConfiguration = typeof mobileAppConfig.$inferSelect;
export type NewMobileAppConfiguration = typeof mobileAppConfig.$inferInsert;
